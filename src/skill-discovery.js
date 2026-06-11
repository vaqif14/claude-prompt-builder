/**
 * Skill Discovery engine
 *
 * Checks which relevant skills exist for a task: what is installed locally, and what the open
 * ecosystem offers via the official `npx skills` CLI. Best-effort and offline-degrading — if the
 * subprocess is missing, times out, or returns garbage, discovery returns status:'unavailable'
 * with a reason and the caller falls back to today's static-match behavior.
 *
 * Hard rules honored here:
 *  - No new runtime deps: Node built-ins only (child_process, fs, path, crypto, os).
 *  - Never installs anything — only reports what exists. Installs are SUGGESTIONS (see assembler).
 *  - Every registry-sourced string is untrusted: neutralized via sanitize before it can reach a
 *    prompt, so a malicious skill description cannot forge a prompt section.
 *  - The `npx skills find` query is shell-sanitized; the subprocess has a timeout + output cap.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scanInstalledSkills } = require('./stack-cache');
const { neutralizeUserText, sanitizeShellArg } = require('./sanitize');

const DEFAULT_CACHE_DIR = '.prompt-builder';
const DISCOVERY_FILE = 'skill-discovery.json';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BUFFER = 1024 * 1024; // 1 MB output cap
const MAX_PER_QUERY = 5;
const DEFAULT_TTL_HOURS = 24;

// Promisified execFile wrapper; tests inject a fake `exec` with the same shape.
function defaultExec(file, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(file, args, opts, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

function discoveryCachePath(cwd, cacheDir) {
  return path.join(cwd, cacheDir, DISCOVERY_FILE);
}

function cacheKey(queries) {
  const norm = [...new Set(queries.map(q => String(q).trim().toLowerCase()))].sort();
  return crypto.createHash('sha256').update(JSON.stringify(norm)).digest('hex').slice(0, 16);
}

function ttlHours(options) {
  const env = parseFloat(process.env.PROMPT_BUILDER_DISCOVERY_TTL_HOURS);
  if (Number.isFinite(env) && env >= 0) return env;
  return Number.isFinite(options.ttlHours) ? options.ttlHours : DEFAULT_TTL_HOURS;
}

// Sanitize a single ecosystem record — registry text is untrusted.
function cleanEntry(name, description, query) {
  return {
    name: neutralizeUserText(String(name || ''), 80),
    description: neutralizeUserText(String(description || ''), 200),
    query,
    relevance: 0,
  };
}

// Parse `npx skills find --json` output; fall back to defensive plain-text parsing.
// Returns { entries: [...], ok: bool, reason: string|null }.
function parseFindOutput(stdout, query) {
  const text = String(stdout || '').trim();
  if (!text) return { entries: [], ok: true, reason: null };

  // Preferred path: JSON array (or { results: [...] }).
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.results) ? parsed.results : null;
    if (arr) {
      const entries = arr
        .map(r => (typeof r === 'string'
          ? cleanEntry(r, '', query)
          : cleanEntry(r.name || r.package || r.id, r.description || r.summary || '', query)))
        .filter(e => e.name);
      return { entries, ok: true, reason: null };
    }
  } catch (_) { /* fall through to text parsing */ }

  // Plain-text fallback: lines like "skill-name   description" or "• skill-name - description".
  const entries = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^[\s•*\-]+/, '').trim();
    if (!line || /^(no results|usage:|error)/i.test(line)) continue;
    const m = line.match(/^([@a-z0-9._/-]+)[\s:|–-]+(.*)$/i) || line.match(/^([@a-z0-9._/-]+)$/i);
    if (m) {
      const e = cleanEntry(m[1], m[2] || '', query);
      if (e.name) entries.push(e);
    }
  }
  if (entries.length === 0) {
    return { entries: [], ok: false, reason: 'find output not parseable as JSON or known text format' };
  }
  return { entries, ok: true, reason: null };
}

function scoreRelevance(entry, query) {
  const hay = `${entry.name} ${entry.description}`.toLowerCase();
  const terms = String(query).toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return 0;
  const hits = terms.filter(t => hay.includes(t)).length;
  return hits / terms.length;
}

function normName(s) {
  return String(s || '').toLowerCase().replace(/^.*[:/]/, '').replace(/[^a-z0-9]+/g, '');
}

/**
 * @param {string[]} queries  search queries (from getSkillSearchQueries)
 * @param {object} options
 *   cwd, cacheDir, refresh(bool), ttlHours, timeoutMs, exec(fn), nowMs(number)
 * @returns {Promise<{installed,available,unavailable,status,reason,checkedAt,fromCache}>}
 */
async function discoverSkills(queries, options = {}) {
  const cwd = options.cwd || process.cwd();
  const cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
  const exec = options.exec || defaultExec;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const qlist = (queries || []).map(q => String(q)).filter(Boolean);
  const key = cacheKey(qlist);

  // Local scan is always available and never cached (cheap, reflects reality now).
  // `roots` is passthrough so tests can isolate from the real ~/.claude/skills.
  const installed = scanInstalledSkills({ cwd, roots: options.roots }).map(s => ({
    name: neutralizeUserText(s.name, 80),
    path: s.path,
    description: neutralizeUserText(s.description || '', 200),
    status: 'installed',
  }));
  const installedNorm = new Set(installed.map(s => normName(s.name)));

  // Cache read (unless refresh requested).
  const cachePath = discoveryCachePath(cwd, cacheDir);
  if (!options.refresh && fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const ageH = (nowMs - Date.parse(cached.checkedAt)) / 3_600_000;
      if (cached.key === key && Number.isFinite(ageH) && ageH < ttlHours(options)) {
        // Re-filter ecosystem hits against the CURRENT installed set (skills may have been installed since).
        const available = (cached.result.available || []).filter(e => !installedNorm.has(normName(e.name)));
        return { installed, available, unavailable: cached.result.unavailable || [], status: cached.result.status, reason: cached.result.reason || null, checkedAt: cached.checkedAt, fromCache: true };
      }
    } catch (_) { /* corrupt cache → re-discover */ }
  }

  // Ecosystem search per query (best-effort).
  const availableMap = new Map();
  const unavailable = [];
  let anyOk = false;
  let lastReason = null;

  for (const query of qlist) {
    const safe = sanitizeShellArg(query);
    if (!safe) continue;
    try {
      const { stdout } = await exec('npx', ['skills', 'find', safe, '--json'], { timeout: timeoutMs, maxBuffer: MAX_BUFFER });
      const { entries, ok, reason } = parseFindOutput(stdout, query);
      if (!ok) { unavailable.push({ query, reason }); lastReason = reason; continue; }
      anyOk = true;
      for (const e of entries) {
        if (installedNorm.has(normName(e.name))) continue; // already installed → not a suggestion
        e.relevance = scoreRelevance(e, query);
        const k = normName(e.name);
        const prev = availableMap.get(k);
        if (!prev || e.relevance > prev.relevance) availableMap.set(k, { ...e, status: 'available' });
      }
    } catch (err) {
      const isEnoent = err && err.code === 'ENOENT';
      const isTimeout = err && err.killed;
      const reason = isTimeout ? `timeout after ${timeoutMs}ms`
        : isEnoent ? 'npx/skills CLI not found'
          : `find failed: ${neutralizeUserText(String(err && err.message || err), 120)}`;
      unavailable.push({ query, reason });
      lastReason = reason;
      // Short-circuit: if the very first attempt fails because the CLI is missing or unreachable
      // (ENOENT / timeout) and nothing has succeeded yet, the rest will fail the same way — stop
      // so a no-network run costs ~one timeout, not one per query.
      if (!anyOk && (isEnoent || isTimeout)) {
        for (const q of qlist.slice(qlist.indexOf(query) + 1)) unavailable.push({ query: q, reason: 'skipped — discovery already unavailable' });
        break;
      }
    }
  }

  const available = [...availableMap.values()]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_PER_QUERY * 2);

  const status = anyOk ? 'ok' : (qlist.length === 0 ? 'ok' : 'unavailable');
  const reason = status === 'unavailable' ? (lastReason || 'ecosystem discovery unavailable') : null;
  const checkedAt = new Date(nowMs).toISOString();
  const result = { available, unavailable, status, reason };

  // Cache write (atomic, 0600). Best-effort — never fail discovery on a write error.
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const tmp = `${cachePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ key, checkedAt, ttlHours: ttlHours(options), result }, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, cachePath);
  } catch (_) { /* ignore */ }

  return { installed, available, unavailable, status, reason, checkedAt, fromCache: false };
}

module.exports = { discoverSkills, parseFindOutput, scoreRelevance, discoveryCachePath, cacheKey, DEFAULT_CACHE_DIR };
