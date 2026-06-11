const fs = require('fs');
const path = require('path');
const os = require('os');

const SCHEMA_VERSION = 2;
const SESSION_ID = /^[A-Za-z0-9_-]{1,100}$/;
const DEFAULT_MAX_PAYLOAD = 512 * 1024;
const DEFAULT_MAX_FILE = 5 * 1024 * 1024;
const DEFAULT_MAX_ARCHIVES = 3;

function createSessionStore(options = {}) {
  const baseDir = options.baseDir || path.join(os.homedir(), '.prompt-builder');
  const sessionsDir = path.join(baseDir, 'sessions');
  const indexPath = path.join(baseDir, 'index.json');
  const legacyPath = path.join(baseDir, 'sessions.json');
  const migrationMarker = path.join(baseDir, '.legacy-migrated-v2');
  const now = options.now || (() => Date.now());
  const random = options.random || (() => Math.random().toString(36).slice(2, 8));
  const maxPayloadBytes = options.maxPayloadBytes || DEFAULT_MAX_PAYLOAD;
  const maxFileBytes = options.maxFileBytes || DEFAULT_MAX_FILE;
  const maxArchives = options.maxArchives || DEFAULT_MAX_ARCHIVES;

  function timestamp() {
    return new Date(now()).toISOString();
  }

  function ensureDirs() {
    fs.mkdirSync(sessionsDir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(baseDir, 0o700); } catch (_) {}
    try { fs.chmodSync(sessionsDir, 0o700); } catch (_) {}
  }

  function validateSessionId(id) {
    if (!SESSION_ID.test(String(id || ''))) throw new Error(`Invalid session id: ${id}`);
    return String(id);
  }

  function sessionPath(id) {
    return path.join(sessionsDir, `${validateSessionId(id)}.jsonl`);
  }

  function parseJsonLines(file) {
    if (!fs.existsSync(file)) return [];
    const events = [];
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event && event.session_id && event.type) events.push(event);
      } catch (_) {
        // A torn final append must not hide earlier valid events.
      }
    }
    return events;
  }

  function sessionFiles(id) {
    ensureDirs();
    const safe = validateSessionId(id);
    return fs.readdirSync(sessionsDir)
      .filter(name => name === `${safe}.jsonl` || (name.startsWith(`${safe}.`) && name.endsWith('.jsonl')))
      .sort()
      .map(name => path.join(sessionsDir, name));
  }

  function readEvents(id) {
    return sessionFiles(id).flatMap(parseJsonLines)
      .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  }

  function capValue(value) {
    if (value == null) return null;
    const text = String(value);
    if (Buffer.byteLength(text) <= maxPayloadBytes) return text;
    return `${text.slice(0, maxPayloadBytes)}\n[truncated by prompt-builder session retention]`;
  }

  function rotateIfNeeded(id) {
    const file = sessionPath(id);
    if (!fs.existsSync(file) || fs.statSync(file).size < maxFileBytes) return;
    const archive = path.join(sessionsDir, `${id}.${Date.now()}.jsonl`);
    fs.renameSync(file, archive);
    const archives = sessionFiles(id).filter(item => item !== file);
    while (archives.length > maxArchives) {
      const oldest = archives.shift();
      try { fs.unlinkSync(oldest); } catch (_) {}
    }
  }

  function appendEvent(id, type, data = {}) {
    ensureDirs();
    const safe = validateSessionId(id);
    rotateIfNeeded(safe);
    const event = {
      schema_version: SCHEMA_VERSION,
      type,
      session_id: safe,
      timestamp: data.timestamp || timestamp(),
      ...data,
    };
    const line = `${JSON.stringify(event)}\n`;
    fs.appendFileSync(sessionPath(safe), line, { encoding: 'utf8', mode: 0o600, flag: 'a' });
    try { fs.chmodSync(sessionPath(safe), 0o600); } catch (_) {}
    return event;
  }

  function summarize(events) {
    if (!events.length) return null;
    const first = events.find(event => event.type === 'session_created') || events[0];
    const last = events[events.length - 1];
    const outcomeEvent = [...events].reverse().find(event => event.type === 'outcome');
    const generation = [...events].reverse().find(event => event.type === 'generation');
    const firstTask = first.task || generation && generation.prompt || '';
    return {
      id: first.session_id,
      task: firstTask,
      // Old records predate titles — fall back to a first-task excerpt so listing never breaks.
      title: first.title || (firstTask ? String(firstTask).replace(/\s+/g, ' ').trim().slice(0, 40) : '(untitled)'),
      mode: first.mode || generation && generation.mode || null,
      stack: first.stack || generation && generation.stack || null,
      template: first.template || generation && generation.template || null,
      created_at: first.timestamp,
      updated_at: last.timestamp,
      outcome: outcomeEvent ? outcomeEvent.outcome : null,
    };
  }

  function rebuildIndex() {
    ensureDirs();
    const ids = new Set();
    for (const name of fs.readdirSync(sessionsDir)) {
      const match = name.match(/^([A-Za-z0-9_-]+)(?:\.\d+)?\.jsonl$/);
      if (match) ids.add(match[1]);
    }
    const sessions = [];
    for (const id of ids) {
      const summary = summarize(readEvents(id));
      if (summary) sessions.push(summary);
    }
    const index = { schema_version: SCHEMA_VERSION, sessions };
    writeIndex(index);
    return index;
  }

  function writeIndex(index) {
    ensureDirs();
    const tmp = `${indexPath}.${process.pid}.${random()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(index, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, indexPath);
    try { fs.chmodSync(indexPath, 0o600); } catch (_) {}
  }

  function readIndex() {
    ensureDirs();
    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      if (index && Array.isArray(index.sessions)) return index;
    } catch (_) { /* rebuild below */ }
    return rebuildIndex();
  }

  function updateIndex(id) {
    const index = readIndex();
    const summary = summarize(readEvents(id));
    const next = index.sessions.filter(session => session.id !== id);
    if (summary) next.push(summary);
    writeIndex({ schema_version: SCHEMA_VERSION, sessions: next });
  }

  function migrateLegacy() {
    ensureDirs();
    if (!fs.existsSync(legacyPath) || fs.existsSync(migrationMarker)) return false;
    let legacy;
    try { legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8')); } catch (_) { return false; }
    const existingKeys = new Set();
    for (const name of fs.readdirSync(sessionsDir)) {
      if (!name.endsWith('.jsonl')) continue;
      for (const event of parseJsonLines(path.join(sessionsDir, name))) {
        if (event.legacy_key) existingKeys.add(event.legacy_key);
      }
    }
    for (const session of legacy.sessions || []) {
      if (!SESSION_ID.test(String(session.id || ''))) continue;
      const key = `session:${session.id}`;
      if (!existingKeys.has(key)) {
        appendEvent(session.id, 'session_created', {
          task: capValue(session.task),
          mode: session.mode || null,
          stack: session.stack || null,
          timestamp: session.created_at || session.updated_at || timestamp(),
          legacy_key: key,
        });
      }
    }
    for (const turn of legacy.turns || []) {
      if (!SESSION_ID.test(String(turn.session_id || ''))) continue;
      const key = `turn:${turn.session_id}:${turn.id}`;
      if (existingKeys.has(key)) continue;
      appendEvent(turn.session_id, 'generation', {
        prompt: capValue(turn.prompt),
        output: capValue(turn.output),
        validation_score: turn.validation_score == null ? null : turn.validation_score,
        estimated_tokens: Math.ceil(String(turn.output || '').length / 4),
        timestamp: turn.timestamp || timestamp(),
        legacy_key: key,
      });
    }
    for (const artifact of legacy.artifacts || []) {
      if (!SESSION_ID.test(String(artifact.session_id || ''))) continue;
      const key = `artifact:${artifact.session_id}:${artifact.id || artifact.timestamp}`;
      if (existingKeys.has(key)) continue;
      appendEvent(artifact.session_id, 'artifact', {
        artifact: capValue(JSON.stringify(artifact)),
        timestamp: artifact.timestamp || timestamp(),
        legacy_key: key,
      });
    }
    rebuildIndex();
    fs.writeFileSync(migrationMarker, `${timestamp()}\n`, { mode: 0o600 });
    return true;
  }

  function createSession(task, mode, stack, id, metadata = {}) {
    migrateLegacy();
    const sessionId = id ? validateSessionId(id) : `sess_${Date.now()}_${random()}`;
    const existing = readEvents(sessionId);
    appendEvent(sessionId, existing.length ? 'session_updated' : 'session_created', {
      task: capValue(task),
      title: metadata.title ? capValue(metadata.title) : null,
      mode: mode || null,
      stack: stack || null,
      template: metadata.template || null,
    });
    updateIndex(sessionId);
    return sessionId;
  }

  function saveTurn(sessionId, prompt, output, score, metadata = {}) {
    migrateLegacy();
    appendEvent(sessionId, 'generation', {
      prompt: capValue(prompt),
      output: capValue(output),
      validation_score: score == null ? null : score,
      estimated_tokens: metadata.estimatedTokens || Math.ceil(String(output || '').length / 4),
      mode: metadata.mode || null,
      stack: metadata.stack || null,
      template: metadata.template || null,
      skill_suggestions: metadata.skillSuggestions || [],
      sections: metadata.sections || [],
    });
    updateIndex(sessionId);
  }

  function recordOutcome(sessionId, outcome, note = '') {
    if (!['success', 'partial', 'fail'].includes(outcome)) throw new Error(`Invalid outcome: ${outcome}`);
    if (!readEvents(sessionId).length) throw new Error(`Session not found: ${sessionId}`);
    appendEvent(sessionId, 'outcome', { outcome, note: capValue(note) });
    updateIndex(sessionId);
    return getSession(sessionId);
  }

  function getSession(sessionId) {
    migrateLegacy();
    const events = readEvents(sessionId);
    if (!events.length) return null;
    const summary = summarize(events);
    const turns = events.filter(event => event.type === 'generation').map((event, index) => ({
      id: index + 1,
      session_id: sessionId,
      prompt: event.prompt || null,
      output: event.output || null,
      validation_score: event.validation_score == null ? null : event.validation_score,
      estimated_tokens: event.estimated_tokens || null,
      timestamp: event.timestamp,
      mode: event.mode || null,
      stack: event.stack || null,
      template: event.template || null,
      skill_suggestions: event.skill_suggestions || [],
      sections: event.sections || [],
    }));
    const artifacts = events.filter(event => event.type === 'artifact');
    return { ...summary, turns, artifacts, events };
  }

  function listSessions(limit = 10) {
    migrateLegacy();
    return [...readIndex().sessions]
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, limit);
  }

  function resumeSession(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;
    return { session, lastTurn: session.turns[session.turns.length - 1] || null };
  }

  function getDb() {
    migrateLegacy();
    const sessions = listSessions(Number.MAX_SAFE_INTEGER);
    const full = sessions.map(session => getSession(session.id));
    return {
      sessions,
      turns: full.flatMap(session => session.turns),
      artifacts: full.flatMap(session => session.artifacts),
      events: full.flatMap(session => session.events),
    };
  }

  return {
    baseDir,
    createSession,
    saveTurn,
    recordOutcome,
    getSession,
    listSessions,
    resumeSession,
    getDb,
    rebuildIndex,
    migrateLegacy,
    validateSessionId,
    close: () => true,
  };
}

const defaultStore = createSessionStore();

module.exports = {
  createSessionStore,
  createSession: (...args) => defaultStore.createSession(...args),
  saveTurn: (...args) => defaultStore.saveTurn(...args),
  recordOutcome: (...args) => defaultStore.recordOutcome(...args),
  getSession: (...args) => defaultStore.getSession(...args),
  listSessions: (...args) => defaultStore.listSessions(...args),
  resumeSession: (...args) => defaultStore.resumeSession(...args),
  getDb: (...args) => defaultStore.getDb(...args),
  close: () => true,
};
