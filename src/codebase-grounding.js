/**
 * Codebase Grounding
 * The differentiator vs a generic prompt builder: actually READ the target repo and
 * extract concrete file:line targets, the real build/test commands, the detected stack,
 * and the project's own invariants — so the generated prompt is grounded, not a template
 * that merely tells the next agent to "go read the codebase".
 *
 * Best-effort and dependency-free: if a repo can't be read, callers fall back to the
 * generic GROUNDING CONTRACT.
 */
const fs = require('fs');
const path = require('path');

const CODE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte',
  '.java', '.kt', '.kts', '.go', '.rs', '.py', '.rb', '.php', '.cs',
]);
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'target',
  'vendor', 'coverage', '.gradle', '.idea', '.vscode', 'bin', 'obj',
  '__pycache__', '.venv', 'venv', '.turbo', '.cache',
]);
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'is', 'are', 'be', 'this',
  'review', 'audit', 'check', 'verify', 'confirm', 'fix', 'add', 'implement', 'create', 'build',
  'plan', 'list', 'best', 'practice', 'practices', 'deviation', 'deviations', 'them', 'it',
  'code', 'quality', 'weak', 'main', 'with', 'into', 'that', 'all', 'working', 'make', 'page',
  'frontend', 'backend', 'app', 'apps', 'new', 'update', 'refactor', 'clean', 'design', 'visual',
]);

// File-extension → surface kind. Used to derive the real surface (UI / service / data)
// from the resolved target files, so build commands, stack profile, and platform align
// with the repo instead of with task-text keyword guesses.
const UI_EXT = new Set(['.tsx', '.jsx', '.vue', '.svelte']);
const SERVICE_EXT = new Set(['.java', '.kt', '.kts', '.go', '.rs', '.cs', '.rb', '.php', '.py']);
const DATA_EXT = new Set(['.sql']);

function exists(cwd, rel) {
  try { return fs.existsSync(path.join(cwd, rel)); } catch (_) { return false; }
}
function read(cwd, rel) {
  try { return fs.readFileSync(path.join(cwd, rel), 'utf8'); } catch (_) { return null; }
}

// --- build tool + commands -------------------------------------------------
function jvmBuild(cwd) {
  const g = exists(cwd, 'build.gradle') || exists(cwd, 'build.gradle.kts') ||
    exists(cwd, 'backend/build.gradle') || exists(cwd, 'backend/build.gradle.kts');
  if (g) {
    const wrap = exists(cwd, 'gradlew') || exists(cwd, 'backend/gradlew');
    const g0 = wrap ? './gradlew' : 'gradle';
    return { tool: 'Gradle', test: `${g0} test`, build: `${g0} build`, lint: `${g0} check` };
  }
  if (exists(cwd, 'pom.xml') || exists(cwd, 'backend/pom.xml')) {
    return { tool: 'Maven', test: 'mvn test', build: 'mvn package', lint: 'mvn verify' };
  }
  if (exists(cwd, 'Cargo.toml')) return { tool: 'Cargo', test: 'cargo test', build: 'cargo build', lint: 'cargo clippy' };
  if (exists(cwd, 'go.mod')) return { tool: 'Go', test: 'go test ./...', build: 'go build ./...', lint: 'go vet ./...' };
  return null;
}

function jsBuild(cwd) {
  const pkgRel = ['package.json', 'frontend/package.json', 'web/package.json'].find(r => exists(cwd, r));
  if (!pkgRel) return null;
  const dir = path.dirname(pkgRel);
  const pm = exists(cwd, path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm'
    : exists(cwd, path.join(dir, 'yarn.lock')) ? 'yarn' : 'npm';
  let scripts = {};
  try { scripts = (JSON.parse(read(cwd, pkgRel)) || {}).scripts || {}; } catch (_) {}
  const run = (s) => scripts[s] ? `${pm}${pm === 'npm' ? ' run' : ''} ${s}` : null;
  return {
    tool: pm,
    dir: dir === '.' ? null : dir,
    test: run('test'),
    build: run('build'),
    lint: run('lint'),
    typecheck: run('typecheck') || run('type-check'),
  };
}

// `prefer`: 'js' for UI surfaces, 'jvm' for service surfaces — so a frontend task in a
// monorepo gets pnpm commands, not the backend's Gradle (and vice-versa).
function detectBuildAndTest(cwd, prefer) {
  if (prefer === 'js') return jsBuild(cwd) || jvmBuild(cwd);
  if (prefer === 'jvm') return jvmBuild(cwd) || jsBuild(cwd);
  return jvmBuild(cwd) || jsBuild(cwd);
}

// --- surface inference from the resolved targets ---------------------------
// The repo scan is the source of truth: a task whose targets are all `.tsx` under
// frontend/ is a UI task no matter how the request was worded (e.g. Azerbaijani text
// that misses the English platform keywords). This drives prefer/build, stack, and
// platform so they stop contradicting GROUNDED TARGETS.
function surfaceFromTargets(targets) {
  let ui = 0, service = 0, data = 0;
  for (const t of targets || []) {
    const f = String(t).split(' ')[0];
    const ext = path.extname(f).toLowerCase();
    const lower = f.toLowerCase();
    if (UI_EXT.has(ext)) ui++;
    else if (SERVICE_EXT.has(ext)) service++;
    else if (DATA_EXT.has(ext)) data++;
    else if (ext === '.ts' || ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      // Ambiguous JS/TS: a frontend client vs a node service — bias by path.
      if (/(^|\/)(frontend|web|client|components?|pages?|features?|ui)(\/|$)/.test(lower)) ui++;
      else service++;
    }
  }
  return { ui, service, data };
}

function classifySurface(counts) {
  const total = counts.ui + counts.service + counts.data;
  if (!total) return null;
  const max = Math.max(counts.ui, counts.service, counts.data);
  const kind = max === counts.data && max > counts.service && max > counts.ui ? 'data'
    : max === counts.service && max >= counts.ui ? 'service'
      : 'ui';
  return {
    kind,
    confident: max / total >= 0.6,
    isUi: kind === 'ui',
    isService: kind === 'service',
    isData: kind === 'data',
  };
}

// Map the detected stack to a bundled stack-profile CSV name, aligned to the surface
// the work targets. Returns null when nothing maps cleanly (caller keeps its own guess).
function detectServiceStackFromFiles(cwd) {
  const pkgRel = ['backend/package.json', 'server/package.json', 'api/package.json', 'package.json'].find(r => exists(cwd, r));
  if (pkgRel) {
    let deps = {};
    try { const p = JSON.parse(read(cwd, pkgRel)); deps = { ...(p.dependencies || {}), ...(p.devDependencies || {}) }; } catch (_) {}
    if (deps['@nestjs/core']) return 'nestjs';
    if (deps['express'] || deps['fastify'] || deps['koa']) return 'node-express';
  }
  const py = `${read(cwd, 'requirements.txt') || ''}\n${read(cwd, 'pyproject.toml') || ''}\n${read(cwd, 'Pipfile') || ''}`;
  if (/\bdjango\b/i.test(py)) return 'python-django';
  if (/\bfastapi\b/i.test(py)) return 'python-fastapi';
  if (exists(cwd, 'go.mod')) return 'go';
  if (exists(cwd, 'Cargo.toml')) return 'rust';
  if (exists(cwd, 'composer.json') && /laravel/i.test(read(cwd, 'composer.json') || '')) return 'laravel';
  if (exists(cwd, 'Gemfile') && /rails/i.test(read(cwd, 'Gemfile') || '')) return 'ruby-rails';
  return null;
}

function pickStackName(cwd, stackList, kind) {
  const has = (re) => (stackList || []).some(s => re.test(s));
  if (kind === 'service') {
    if (has(/Spring Boot/)) return 'spring-boot';
    return detectServiceStackFromFiles(cwd);
  }
  if (kind === 'ui') {
    if (has(/Next\.js/)) return 'nextjs';
    if (has(/\bReact\b/)) return 'nextjs';
    return null;
  }
  return null; // data / unknown: leave the caller's own stack detection in place
}

// --- detected stack from real manifests ------------------------------------
function detectStackFromDeps(cwd) {
  const out = [];
  const pkgRel = ['package.json', 'frontend/package.json', 'web/package.json'].find(r => exists(cwd, r));
  if (pkgRel) {
    let deps = {};
    try { const p = JSON.parse(read(cwd, pkgRel)); deps = { ...(p.dependencies || {}), ...(p.devDependencies || {}) }; } catch (_) {}
    const has = (n) => Object.prototype.hasOwnProperty.call(deps, n);
    const ver = (n) => (deps[n] || '').replace(/[^0-9.].*$/, '');
    if (has('next')) out.push(`Next.js ${ver('next') || ''}`.trim());
    else if (has('react')) out.push(`React ${ver('react') || ''}`.trim());
    if (has('vue')) out.push('Vue');
    if (has('svelte')) out.push('Svelte');
    if (has('@angular/core')) out.push('Angular');
    if (has('@mui/material')) out.push(`MUI ${ver('@mui/material') || ''}`.trim());
    if (has('tailwindcss')) out.push('Tailwind');
    if (Object.keys(deps).some(d => d.startsWith('@radix-ui') || d === 'shadcn-ui')) out.push('shadcn/Radix');
    if (has('@tanstack/react-query')) out.push('TanStack Query');
    if (has('zustand')) out.push('Zustand');
    if (has('@reduxjs/toolkit') || has('redux')) out.push('Redux');
    if (has('next-intl')) out.push('next-intl');
    if (has('react-hook-form')) out.push('react-hook-form');
    if (has('zod')) out.push('zod');
  }
  const gradle = read(cwd, 'build.gradle.kts') || read(cwd, 'build.gradle') ||
    read(cwd, 'backend/build.gradle.kts') || read(cwd, 'backend/build.gradle') || '';
  if (gradle) {
    if (/org\.springframework\.boot/.test(gradle)) out.push('Spring Boot');
    if (/spring-boot-starter-security/.test(gradle)) out.push('Spring Security');
    if (/spring-boot-starter-data-jpa/.test(gradle)) out.push('Spring Data JPA');
    if (/spring-boot-starter-ldap|spring-security-ldap/.test(gradle)) out.push('LDAP');
    if (/flyway/.test(gradle)) out.push('Flyway');
    if (/liquibase/.test(gradle)) out.push('Liquibase');
    if (/testcontainers/.test(gradle)) out.push('Testcontainers');
    const jv = gradle.match(/(?:sourceCompatibility|languageVersion|JavaLanguageVersion\.of)\D*(\d{2})/);
    if (jv) out.push(`Java ${jv[1]}`);
  }
  return [...new Set(out)].filter(Boolean);
}

// --- candidate target files by task tokens ---------------------------------
function tokenize(task) {
  return [...new Set(
    String(task || '').toLowerCase().split(/[^a-z0-9]+/)
      .filter(t => t.length >= 3 && !STOPWORDS.has(t))
  )];
}

function walk(cwd, roots, opts = {}) {
  const maxFiles = opts.maxFiles || 6000;
  const maxDepth = opts.maxDepth || 8;
  const files = [];
  const stack = roots.filter(r => exists(cwd, r)).map(r => ({ rel: r, depth: 0 }));
  while (stack.length && files.length < maxFiles) {
    const { rel, depth } = stack.pop();
    if (depth > maxDepth) continue;
    let entries;
    try { entries = fs.readdirSync(path.join(cwd, rel), { withFileTypes: true }); } catch (_) { continue; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.') continue;
      const childRel = path.join(rel, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        stack.push({ rel: childRel, depth: depth + 1 });
      } else if (CODE_EXT.has(path.extname(e.name))) {
        files.push(childRel);
        if (files.length >= maxFiles) break;
      }
    }
  }
  return files;
}

// `prefer` ('js'|'jvm'|null) gently biases ranking toward the matching surface so a
// backend refactor does not surface stray frontend clients above the real service files.
function findTargets(cwd, task, limit = 8, prefer) {
  const tokens = tokenize(task);
  if (!tokens.length) return [];
  const roots = ['frontend/src', 'backend/src', 'src', 'app', 'lib', 'pkg', 'cmd', 'internal'];
  const files = walk(cwd, roots);
  const scored = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    let score = 0;
    for (const t of tokens) if (lower.includes(t)) score += 1;
    // small bonus for being a page/route/index/service entry
    if (/(page|route|index|controller|service|handler)\.(t|j)sx?$|Controller\.(java|kt)$|Service\.(java|kt)$/.test(f)) score += 0.5;
    // surface bias: nudge matches on the preferred surface above the other side of a monorepo
    if (prefer) {
      const ext = path.extname(f).toLowerCase();
      const isUiFile = UI_EXT.has(ext) || /(^|\/)frontend\//.test(lower);
      const isSvcFile = SERVICE_EXT.has(ext) || /(^|\/)backend\//.test(lower);
      if (prefer === 'js' && isUiFile) score += 0.3;
      if (prefer === 'jvm' && isSvcFile) score += 0.3;
      if (prefer === 'js' && isSvcFile) score -= 0.2;
      if (prefer === 'jvm' && isUiFile) score -= 0.2;
    }
    if (score > 0) scored.push({ file: f, score });
  }
  scored.sort((a, b) => b.score - a.score || a.file.length - b.file.length);
  return scored.slice(0, limit).map(s => annotateTarget(cwd, s.file));
}

function annotateTarget(cwd, file) {
  const txt = read(cwd, file) || '';
  const head = txt.slice(0, 800);
  let note = '';
  if (/\bredirect\s*\(/.test(head) && txt.length < 600) note = ' (redirect/stub — resolve the real target it points to)';
  else if (/^\s*export\s+\{[^}]*\}\s+from/m.test(head) || /^\s*export\s+\*\s+from/m.test(head)) note = ' (barrel/re-export — resolve the underlying module)';
  return `${file}${note}`;
}

// --- project invariants / hard rules from CLAUDE.md / AGENTS.md -------------
// Rank by relevance to the task (not document order) so a bid-refactor surfaces the
// locking/idempotency rules and an anonymity audit surfaces the bidder-identity rule —
// instead of whichever generic guardrail happens to appear first. Tooling/process notes
// (skill descriptions, etc.) are filtered out; rules under hard-rule headings are boosted.
// A bullet is an INVARIANT only by its phrasing (a prohibition/obligation), NOT merely
// because it mentions a domain noun — otherwise architecture lists, test-strategy bullets,
// and bare file paths that happen to say "bid"/"timer"/"audit" get pulled in as "rules".
const INVARIANT_QUALIFY = /\b(do not|never|must not|must be|must stay|must always|cannot|may not|shall not|always (?:do|use|run|keep|preserve|enforce)|required\b|preserve\b|append-only|forbidden|prohibited|enforce|protection point|do not weaken|do not expose|do not log)\b/i;
const INVARIANT_TOOLING = /\b(skill|superpowers|llm-council|claude code session|dispatching-parallel|find-skills|subagent|council)\b/i;
const INVARIANT_HEAVY_HEADING = /(must not|never|bidding|bid rule|timer|security|audit|always do|invariant|concurrenc|realtime|anonym)/i;

function extractInvariants(cwd, task) {
  const doc = read(cwd, 'CLAUDE.md') || read(cwd, 'AGENTS.md') || read(cwd, '.cursorrules') || '';
  if (!doc) return [];
  const lines = doc.split('\n');
  // Build full bullets, absorbing wrapped continuation lines so multi-line rules are
  // not truncated mid-sentence; remember the nearest heading for section weighting.
  const bullets = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{1,6}\s+(.*)$/);
    if (h) { heading = h[1].trim().toLowerCase(); continue; }
    const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
    if (!m) continue;
    let text = m[1];
    let j = i + 1;
    while (j < lines.length && lines[j].trim()
      && !/^\s*[-*]\s+/.test(lines[j]) && !/^#{1,6}\s/.test(lines[j]) && !/^\s*\|/.test(lines[j])) {
      text += ' ' + lines[j].trim();
      j++;
    }
    i = j - 1;
    bullets.push({ text: text.replace(/[`*]/g, '').trim(), heading });
  }
  const tokens = tokenize(task);
  const scored = [];
  for (const b of bullets) {
    const text = b.text;
    if (text.length <= 12 || text.length >= 280) continue;
    if ((text.match(/\(/g) || []).length > (text.match(/\)/g) || []).length) continue; // truncated
    if (!INVARIANT_QUALIFY.test(text)) continue;       // must be phrased as a rule, not a mention
    if (INVARIANT_TOOLING.test(text)) continue;        // drop tooling / process notes, not real invariants
    if (/\.(java|kt|tsx?|jsx?|go|rs|py|sql)\b/i.test(text) && text.length < 80) continue; // bare file path
    let score = 0;
    const tl = text.toLowerCase();
    for (const t of tokens) if (tl.includes(t)) score += 3;            // task relevance dominates
    if (INVARIANT_HEAVY_HEADING.test(b.heading)) score += 2;           // under a hard-rule heading
    if (/\b(do not weaken|must not|never)\b/i.test(text)) score += 1;  // strongest phrasing
    scored.push({ text, score });
  }
  // Highest relevance first; preserve document order within equal scores (stable).
  const ordered = scored.map((s, idx) => ({ ...s, idx }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);
  const out = [];
  const seen = new Set();
  for (const c of ordered) {
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    out.push(c.text);
    if (out.length >= 8) break;
  }
  return out;
}

function detectSourceRoots(cwd) {
  return ['frontend/src', 'backend/src', 'src', 'app', 'lib', 'pkg', 'cmd', 'internal']
    .filter(r => exists(cwd, r));
}

// When the task names no surface (e.g. "fix code quality"), the real grounding for a
// refactor is "which files are biggest/most complex" — the likely god-classes/offenders.
function findLargestFiles(cwd, roots, limit = 8) {
  const sized = [];
  for (const f of walk(cwd, roots)) {
    try { sized.push({ f, size: fs.statSync(path.join(cwd, f)).size }); } catch (_) {}
  }
  sized.sort((a, b) => b.size - a.size);
  // Compute real LOC for the largest candidates by bytes, then rank by LOC (what we
  // display) so the printed order is truthful and monotonic.
  const top = sized.slice(0, Math.max(limit * 3, 24)).map((s) => {
    let loc = 0;
    try { loc = (fs.readFileSync(path.join(cwd, s.f), 'utf8').match(/\n/g) || []).length + 1; } catch (_) {}
    return { f: s.f, loc };
  });
  top.sort((a, b) => b.loc - a.loc);
  return top.slice(0, limit).map((s) => `${s.f} (${s.loc} lines — large/complex, likely refactor candidate)`);
}

function groundInRepo(input = {}) {
  const cwd = input.cwd || process.cwd();
  let build = null, targets = [], invariants = [], stack = [], roots = [], targetsBySize = false;
  try { targets = findTargets(cwd, input.task, input.limit || 8, input.prefer); } catch (_) {}
  try { invariants = extractInvariants(cwd, input.task); } catch (_) {}
  try { stack = detectStackFromDeps(cwd); } catch (_) {}
  // Token-less task → fall back to the largest files in the surface-relevant root,
  // which for a quality refactor are the most likely targets.
  if (!targets.length) {
    try { roots = detectSourceRoots(cwd); } catch (_) {}
    const relRoots = input.prefer === 'js' ? ['frontend/src', 'src', 'app']
      : input.prefer === 'jvm' ? ['backend/src', 'src'] : roots;
    try {
      const big = findLargestFiles(cwd, relRoots.filter(r => exists(cwd, r)), input.limit || 8);
      if (big.length) { targets = big; targetsBySize = true; }
    } catch (_) {}
  }
  // Surface is inferred from the resolved targets (repo truth). The effective build
  // preference honors an explicit caller prefer, else derives from the surface — so a
  // frontend task gets pnpm and a backend task gets Gradle in a dual-build monorepo.
  const surface = classifySurface(surfaceFromTargets(targets));
  const prefer = input.prefer || (surface ? (surface.isUi ? 'js' : surface.isService ? 'jvm' : null) : null);
  try { build = detectBuildAndTest(cwd, prefer); } catch (_) {}
  const stackName = surface ? pickStackName(cwd, stack, surface.kind) : null;
  const grounded = Boolean(build || targets.length || invariants.length || stack.length || roots.length);
  return { grounded, cwd, build, targets, targetsBySize, roots, invariants, stack, surface, prefer, stackName };
}

module.exports = {
  groundInRepo,
  detectBuildAndTest,
  detectStackFromDeps,
  findTargets,
  extractInvariants,
  tokenize,
  surfaceFromTargets,
  classifySurface,
  pickStackName,
};
