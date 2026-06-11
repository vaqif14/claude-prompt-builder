/**
 * Title engine (v2.1.0) — topic-derived, human-readable titles + filesystem slugs.
 *
 * Pure heuristics, deterministic, no deps, no LLM. The title is rendered into the prompt and into
 * filenames, so the task (untrusted) is run through the structural neutralizer first.
 */

const { neutralizeUserText } = require('./sanitize');

// Stack slug → display label (prefix). Unknown slugs fall back to Title-Cased words.
const STACK_LABELS = {
  'spring-boot': 'Spring Boot', nextjs: 'Next.js', 'react-native': 'React Native',
  'ios-swift': 'iOS', 'android-kotlin': 'Android', dotnet: '.NET', 'ai-app': 'AI App',
  'data-ml': 'Data/ML', 'node-express': 'Node', 'python-fastapi': 'FastAPI',
  'python-django': 'Django', laravel: 'Laravel', flutter: 'Flutter', go: 'Go', rust: 'Rust',
  postgres: 'Postgres', mysql: 'MySQL', db: 'Database', devops: 'DevOps', cli: 'CLI', desktop: 'Desktop',
};

// Mode → suffix that adds meaning. `general`/`feature` add nothing.
const MODE_SUFFIX = {
  bugfix: 'fix', 'security-review': 'security audit', 'design-review': 'design review',
  'performance-review': 'performance review', 'architecture-review': 'architecture review',
  audit: 'review', refactor: 'refactor', 'release-check': 'release check',
  'prd-to-tasks': 'task breakdown', hackathon: 'MVP', 'agent-readiness': 'agent audit',
  'tooling-review': 'tooling audit', 'skill-review': 'skill review',
};

// Words that carry no topic signal: instruction verbs, fillers, stopwords (EN + AZ/TR).
const DROP = new Set([
  // instruction verbs
  'fix', 'fixes', 'fixed', 'update', 'updates', 'make', 'create', 'add', 'adds', 'implement',
  'build', 'review', 'reviews', 'audit', 'check', 'verify', 'confirm', 'refactor', 'clean',
  'cleanup', 'optimize', 'optimise', 'improve', 'analyze', 'analyse', 'investigate', 'debug',
  'handle', 'do', 'redesign', 'design', 'rewrite', 'modernize', 'enable', 'support', 'rebuild',
  'düzəlt', 'yenilə', 'yoxla', 'əlavə', 'et', 'bax', 'düzelt',
  // fillers
  'please', 'deeply', 'asap', 'slow', 'broken', 'thing', 'things', 'stuff', 'service', 'services',
  'app', 'application', 'project', 'codebase', 'code', 'new', 'old', 'some', 'all', 'fast', 'yavaş',
  // stopwords EN
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'our', 'your', 'its', 'in', 'on', 'at',
  'to', 'of', 'for', 'with', 'and', 'or', 'but', 'is', 'are', 'be', 'just', 'really', 'very',
  'into', 'from', 'by', 'as', 'it',
  // stopwords AZ/TR
  'bizim', 'bu', 'o', 'və', 've', 'ki', 'mənim', 'üçün', 'ile', 'ilə', 'bir',
]);

function titleCase(str) {
  return String(str || '').replace(/\b([a-zəçğışöü])/gi, m => m.toUpperCase());
}

function stackLabel(stack) {
  if (!stack || stack === 'general') return null;
  return STACK_LABELS[stack] || titleCase(String(stack).replace(/-/g, ' '));
}

// Tokenize keeping unicode letters/digits (so Azerbaijani words survive).
function tokens(text) {
  return String(text || '').toLowerCase().split(/[^0-9a-zəçğışöüâî]+/i).filter(Boolean);
}

/**
 * @param {string} task
 * @param {object} analysis  { stack, platform, mode, domains } — accepted from the caller; we do
 *                           NOT re-derive keyword extraction here.
 * @returns {string} human title, ≤60 chars, deterministic.
 */
function deriveTitle(task, analysis = {}) {
  const safeTask = neutralizeUserText(task, 200) || '';
  const { stack, platform, mode } = analysis;

  const prefix = stackLabel(stack) || (platform && platform !== 'general' ? titleCase(platform) : null);
  const prefixTokens = new Set(prefix ? tokens(prefix) : []);

  // Core: salient words from the task minus drop-words and any token already in the prefix.
  const core = [];
  const seen = new Set();
  for (const tok of tokens(safeTask)) {
    if (tok.length < 2 || DROP.has(tok) || prefixTokens.has(tok) || seen.has(tok)) continue;
    seen.add(tok);
    core.push(tok);
    if (core.length >= 5) break;
  }

  // Suffix: mode label, unless its words are already in the core (avoid "query fix fix").
  let suffix = MODE_SUFFIX[mode] || '';
  if (suffix && suffix.split(' ').every(w => seen.has(w))) suffix = '';

  let body = [core.join(' '), suffix].filter(Boolean).join(' ').trim();

  // Fallback chain when extraction yields nothing meaningful.
  if (!body) {
    body = tokens(safeTask).slice(0, 6).join(' ').trim();
    if (!body) return 'Untitled task';
  }

  let title = prefix ? `${prefix}: ${body}` : body;
  title = title.replace(/\s+/g, ' ').trim().replace(/[.,;:!?\-\s]+$/, '');
  if (title.length > 60) {
    title = title.slice(0, 60).replace(/\s+\S*$/, '').replace(/[.,;:!?\-\s]+$/, '') || title.slice(0, 60);
  }
  return title || 'Untitled task';
}

// Azerbaijani/Turkish → ASCII transliteration for slugs.
const TRANSLIT = { ə: 'e', ş: 's', ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', â: 'a', î: 'i', İ: 'i' };

/**
 * @param {string} title
 * @returns {string} filesystem-safe slug, ≤50 chars, never empty (fallback 'prompt').
 */
function deriveSlug(title) {
  const ascii = String(title || '')
    .toLowerCase()
    .replace(/[əşçğıöüâîİ]/g, ch => TRANSLIT[ch] || ch)
    .normalize('NFKD').replace(/[̀-ͯ]/g, ''); // strip remaining diacritics
  let slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > 50) slug = slug.slice(0, 50).replace(/-+$/g, '');
  return slug || 'prompt';
}

module.exports = { deriveTitle, deriveSlug, stackLabel, STACK_LABELS, MODE_SUFFIX };
