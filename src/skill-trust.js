const fs = require('fs');
const path = require('path');
const { loadCsv, validateRows } = require('./data-loader');
const { neutralizeUserText } = require('./sanitize');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');
const ALLOWED_EXTENSIONS = new Set([
  '.md', '.txt', '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx',
  '.sh', '.bash', '.zsh', '.json', '.yaml', '.yml', '.toml',
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor']);

function loadTrustPatterns(dataDir = DEFAULT_DATA_DIR) {
  const file = path.join(dataDir, 'skill-trust-patterns.csv');
  const required = ['id', 'category', 'severity', 'matcher_kind', 'needle', 'label'];
  const rows = loadCsv(file, {
    header: true,
    requiredColumns: required,
    allowSecurityPatterns: true,
  });
  return validateRows(rows, {
    required,
    unique: 'id',
    enums: {
      severity: ['low', 'medium', 'high'],
      matcher_kind: ['fixed', 'sequence'],
    },
  }, file);
}

function lineExcerpt(text, index) {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const value = text.split('\n')[line - 1] || '';
  return { line, excerpt: value.trim().slice(0, 240) };
}

function matchPattern(text, pattern) {
  const lower = text.toLowerCase();
  if (pattern.matcher_kind === 'fixed') {
    const index = lower.indexOf(pattern.needle.toLowerCase());
    return index >= 0 ? index : null;
  }
  const tokens = pattern.needle.split('&&').map(token => token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length || !tokens.every(token => lower.includes(token))) return null;
  return Math.min(...tokens.map(token => lower.indexOf(token)).filter(index => index >= 0));
}

function screenText(text, where, options = {}) {
  const patterns = options.patterns || loadTrustPatterns(options.dataDir);
  const findings = [];
  for (const pattern of patterns) {
    const index = matchPattern(String(text || ''), pattern);
    if (index == null) continue;
    const context = lineExcerpt(String(text || ''), index);
    findings.push({
      id: pattern.id,
      pattern: pattern.label,
      category: pattern.category,
      severity: pattern.severity,
      where: `${where}:${context.line}`,
      excerpt: context.excerpt,
    });
  }
  return findings;
}

function riskFromFindings(findings, screened) {
  if (findings.some(finding => finding.severity === 'high')) return 'high';
  if (findings.some(finding => finding.severity === 'medium')) return 'medium';
  return screened === 'full-local' || screened === 'skill-md-only' ? 'low' : 'unknown';
}

function scanLocalSkill(skillFile, options = {}) {
  const root = fs.realpathSync(path.dirname(skillFile));
  const maxFiles = options.maxFiles || 40;
  const maxFileBytes = options.maxFileBytes || 64 * 1024;
  const maxTotalBytes = options.maxTotalBytes || 256 * 1024;
  const files = [];
  const structuralFindings = [];
  let totalBytes = 0;
  let truncated = false;

  const visit = dir => {
    if (files.length >= maxFiles || totalBytes >= maxTotalBytes) {
      truncated = true;
      return;
    }
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if (files.length >= maxFiles || totalBytes >= maxTotalBytes) { truncated = true; break; }
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          const target = fs.realpathSync(full);
          if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
            structuralFindings.push({
              id: 'symlink-outside-root',
              pattern: 'Symlink outside skill root',
              category: 'privilege',
              severity: 'medium',
              where: path.relative(root, full),
              excerpt: `symlink target outside ${root}`,
            });
          }
        } catch (_) { /* broken symlink is ignored */ }
        continue;
      }
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (entry.name !== 'SKILL.md' && !ALLOWED_EXTENSIONS.has(ext)) continue;
      let size = 0;
      try { size = fs.statSync(full).size; } catch (_) { continue; }
      if (size > maxFileBytes || totalBytes + size > maxTotalBytes) {
        truncated = true;
        continue;
      }
      files.push(full);
      totalBytes += size;
    }
  };
  visit(root);

  const patterns = loadTrustPatterns(options.dataDir);
  const findings = [...structuralFindings];
  for (const file of files) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
    findings.push(...screenText(text, path.relative(root, file) || 'SKILL.md', { patterns }));
  }
  const screened = files.some(file => path.basename(file) !== 'SKILL.md') ? 'full-local' : 'skill-md-only';
  return {
    risk: riskFromFindings(findings, screened),
    findings,
    screened,
    scannedFiles: files.length,
    scannedBytes: totalBytes,
    truncated,
  };
}

function assessSkillTrust(skill, options = {}) {
  if (skill && skill.path && fs.existsSync(skill.path)) {
    try {
      return scanLocalSkill(skill.path, options);
    } catch (error) {
      return { risk: 'unknown', findings: [], screened: 'unavailable', reason: error.message };
    }
  }
  if (skill && skill.description) {
    const findings = screenText(skill.description, 'description', options);
    return {
      risk: riskFromFindings(findings, 'description-only'),
      findings,
      screened: 'description-only',
    };
  }
  return { risk: 'unknown', findings: [], screened: 'unavailable' };
}

function renderTrustNote(result) {
  if (!result || result.screened === 'unavailable') return 'trust: unknown (no screenable content)';
  if (result.risk === 'low') return `trust: low risk (${result.screened} static pre-screen)`;
  if (!result.findings.length) return 'trust: limited (description-only; no security guarantee)';
  const names = [...new Set(result.findings.map(finding => finding.pattern))].join(', ');
  return `trust: ${result.risk} risk, ${result.findings.length} finding(s) — review before installing: ${names}`;
}

function renderTrustDetails(result) {
  return (result.findings || []).map(finding => ({
    ...finding,
    excerpt: neutralizeUserText(finding.excerpt, 240),
  }));
}

module.exports = {
  loadTrustPatterns,
  screenText,
  scanLocalSkill,
  assessSkillTrust,
  renderTrustNote,
  renderTrustDetails,
};
