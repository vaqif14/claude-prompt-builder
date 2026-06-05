const fs = require('fs');
const os = require('os');
const path = require('path');
const { neutralizeUserText } = require('./sanitize');

const DEFAULT_CACHE_DIR = '.prompt-builder/stack-profiles';
const MAX_SKILL_FILES = 500;

function slugify(input) {
  return String(input || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general';
}

function getStackProfilePath(stack, options = {}) {
  const cwd = options.cwd || process.cwd();
  const cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
  return path.join(cwd, cacheDir, `${slugify(stack)}.md`);
}

function relativeToCwd(file, cwd = process.cwd()) {
  const rel = path.relative(cwd, file);
  return rel && !rel.startsWith('..') ? rel : file;
}

function parseSkillFile(skillFile) {
  const text = fs.readFileSync(skillFile, 'utf8');
  const head = text.slice(0, 4000);
  const name = (head.match(/^name:\s*["']?(.+?)["']?\s*$/m) || [])[1];
  const description = (head.match(/^description:\s*["']?(.+?)["']?\s*$/m) || [])[1];
  return {
    name: (name || path.basename(path.dirname(skillFile))).trim(),
    description: (description || '').trim(),
    path: skillFile,
  };
}

function defaultSkillRoots(cwd = process.cwd()) {
  const home = os.homedir();
  return [
    path.join(cwd, '.claude/skills'),
    path.join(cwd, '.codex/skills'),
    path.join(cwd, '.agents/skills'),
    path.join(cwd, '.codex/plugins/cache'),
    path.join(home, '.claude/skills'),
    path.join(home, '.codex/skills'),
    path.join(home, '.agents/skills'),
    path.join(home, '.codex/plugins/cache'),
  ];
}

function scanInstalledSkills(options = {}) {
  const cwd = options.cwd || process.cwd();
  const roots = options.roots || defaultSkillRoots(cwd);
  const found = [];
  const visited = new Set();

  function visit(dir, depth) {
    if (found.length >= MAX_SKILL_FILES || depth > 6) return;
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch (_) {
      return;
    }
    if (visited.has(real)) return;
    visited.add(real);

    const skillFile = path.join(real, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      try {
        found.push(parseSkillFile(skillFile));
      } catch (_) {
        // Ignore malformed skill files; the cache should still be generated.
      }
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(real, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (found.length >= MAX_SKILL_FILES) break;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      visit(path.join(real, entry.name), depth + 1);
    }
  }

  for (const root of roots) visit(root, 0);

  const unique = new Map();
  for (const skill of found) {
    const key = `${normalize(skill.name)}:${skill.path}`;
    if (!unique.has(key)) unique.set(key, skill);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^.*:/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function matchInstalledSkills(skillPlan, installedSkills) {
  const desired = skillPlan.map(item => item.skill);
  const installed = [];
  const missing = [];

  for (const skill of desired) {
    const wanted = normalize(skill);
    const match = installedSkills.find(candidate => {
      const name = normalize(candidate.name);
      const file = normalize(path.basename(path.dirname(candidate.path)));
      const hasLongAlias = name.length >= 5 && wanted.length >= 5;
      return name === wanted || file === wanted || (hasLongAlias && (wanted.endsWith(name) || name.endsWith(wanted)));
    });

    if (match) installed.push({ skill, match });
    else missing.push(skill);
  }

  return { installed, missing };
}

function listSection(title, items, formatter) {
  const lines = [`## ${title}`, ''];
  if (!items || items.length === 0) {
    lines.push('- None recorded yet.', '');
    return lines;
  }
  for (const item of items) lines.push(`- ${formatter ? formatter(item) : item}`);
  lines.push('');
  return lines;
}

function buildStackProfileMarkdown(input) {
  const {
    stack,
    task,
    platforms,
    stackContext,
    bestPractices,
    antiPatterns,
    verificationGates,
    skillPlan,
    skillQueries,
    installedSkills,
    cwd,
  } = input;

  const matches = matchInstalledSkills(skillPlan, installedSkills);
  const pkg = require('../package.json');
  const generatedAt = new Date().toISOString();
  const lines = [
    `# Prompt Builder Stack Profile: ${stack}`,
    '',
    `Generated: ${generatedAt}`,
    `Generator: @vaqif14/prompt-builder ${pkg.version}`,
    `Seed task: ${neutralizeUserText(task)}`,
    '',
    '## Reuse Contract',
    '',
    '- Read this file before building prompts for this stack.',
    '- If this file exists, do not repeat broad local/ecosystem skill discovery.',
    '- Use the cached installed skills, missing-skill queue, best practices, anti-patterns, and verification gates below.',
    '- Refresh only when the stack changes, a better skill is needed, or the user asks for refresh.',
    '- Install missing skills only after explicit user approval.',
    '',
    '## Detected Platforms',
    '',
    ...platforms.map(platform => `- ${platform.label}: evidence=${platform.evidence}`),
    '',
    ...listSection('Stack Context', stackContext),
    ...listSection('Best Practices', bestPractices),
    ...listSection('Anti-Patterns', antiPatterns),
    ...listSection('Verification Gates', verificationGates),
    ...listSection('Required Skills', skillPlan, item => `${item.skill} - ${item.reason}`),
    ...listSection('Installed Skill Matches', matches.installed, item => `${item.skill} -> ${item.match.name} (${relativeToCwd(item.match.path, cwd)})`),
    ...listSection('Missing / Approval-Required Skills', matches.missing, skill => `${skill} - install only after user accepts: npx skills add ${skill} -g -y`),
    ...listSection('Ecosystem Refresh Queries', skillQueries, query => `npx skills find "${query}"`),
    '## Prompt Builder Notes',
    '',
    '- Cache status HIT means prompt generation should not ask the next agent to search for skills again.',
    '- Cache status MISS means this file was just generated from bundled stack intelligence plus installed skill metadata.',
    '- If a required skill is missing, the generated prompt should ask for approval before installing it.',
    '',
  ];

  return lines.join('\n');
}

function ensureStackProfile(input) {
  const cwd = input.cwd || process.cwd();
  const profilePath = getStackProfilePath(input.stack, { cwd, cacheDir: input.cacheDir });
  const exists = fs.existsSync(profilePath);

  if (exists && !input.refresh) {
    return {
      status: 'hit',
      path: profilePath,
      relativePath: relativeToCwd(profilePath, cwd),
      content: fs.readFileSync(profilePath, 'utf8'),
    };
  }

  const installedSkills = scanInstalledSkills({ cwd });
  const content = buildStackProfileMarkdown({
    ...input,
    cwd,
    installedSkills,
  });

  fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  fs.writeFileSync(profilePath, content, 'utf8');

  return {
    status: exists ? 'refreshed' : 'created',
    path: profilePath,
    relativePath: relativeToCwd(profilePath, cwd),
    content,
  };
}

module.exports = {
  DEFAULT_CACHE_DIR,
  ensureStackProfile,
  getStackProfilePath,
  scanInstalledSkills,
  matchInstalledSkills,
};
