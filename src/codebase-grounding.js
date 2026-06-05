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

function findTargets(cwd, task, limit = 8) {
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
function extractInvariants(cwd) {
  const doc = read(cwd, 'CLAUDE.md') || read(cwd, 'AGENTS.md') || read(cwd, '.cursorrules') || '';
  if (!doc) return [];
  const lines = doc.split('\n');
  // Build full bullets, absorbing wrapped continuation lines so multi-line rules are
  // not truncated mid-sentence.
  const bullets = [];
  for (let i = 0; i < lines.length; i++) {
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
    bullets.push(text.replace(/[`*]/g, '').trim());
  }
  const out = [];
  for (const text of bullets) {
    if ((text.match(/\(/g) || []).length > (text.match(/\)/g) || []).length) continue;
    if (/\b(do not weaken|never|do not|must not|always|append-only|idempotenc|locking|invariant|race condition)\b/i.test(text)
      && text.length > 12 && text.length < 280) {
      out.push(text);
    }
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
  try { build = detectBuildAndTest(cwd, input.prefer); } catch (_) {}
  try { targets = findTargets(cwd, input.task, input.limit || 8); } catch (_) {}
  try { invariants = extractInvariants(cwd); } catch (_) {}
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
  const grounded = Boolean(build || targets.length || invariants.length || stack.length || roots.length);
  return { grounded, cwd, build, targets, targetsBySize, roots, invariants, stack };
}

module.exports = {
  groundInRepo,
  detectBuildAndTest,
  detectStackFromDeps,
  findTargets,
  extractInvariants,
  tokenize,
};
