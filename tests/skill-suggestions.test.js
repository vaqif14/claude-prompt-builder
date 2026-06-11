const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classifySkills, buildSkillSuggestions } = require('../src/skill-matcher');
const { generatePrompt } = require('../src/index');
const { dismissSkill, isDismissed, readConfig } = require('../src/project-config');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (e) { console.log(`  ❌ ${name}`); console.log(`     ${e.message}`); process.exitCode = 1; }
}

console.log('\nSkill Suggestions / Three-State Tests');

const PLAN = [
  { skill: 'find-skills', reason: 'discover skills', instruction: 'Run this before domain work.' },
  { skill: 'frontend-patterns', reason: 'component architecture', instruction: 'Load this first for Web.' },
  { skill: 'enterprise-ui-architect', reason: 'admin dashboard structure', instruction: 'Load this first.' },
];

const DISCOVERY = {
  status: 'ok', reason: null, fromCache: false,
  installed: [{ name: 'frontend-patterns', path: '/x/.claude/skills/frontend-patterns', description: 'fe' }],
  available: [{ name: 'enterprise-ui-architect', description: 'admin dashboard structure review', query: 'admin dashboard ui review', relevance: 0.9, status: 'available' }],
  unavailable: [],
};

test('classifySkills: three states + ordering (installed → suggested → unverified)', () => {
  const a = classifySkills(PLAN, DISCOVERY);
  const states = a.map(s => s.statusState);
  const idx = { installed: states.indexOf('installed'), suggested: states.indexOf('suggested') };
  assert(a.find(s => s.skill === 'frontend-patterns').statusState === 'installed');
  assert(a.find(s => s.skill === 'enterprise-ui-architect').statusState === 'suggested');
  if (idx.installed !== -1 && idx.suggested !== -1) assert(idx.installed < idx.suggested, 'installed before suggested');
});

test('classifySkills: no discovery → everything unverified, load-first rewritten', () => {
  const a = classifySkills(PLAN, null);
  assert(a.every(s => s.statusState === 'unverified'), 'all unverified without discovery');
  const fe = a.find(s => s.skill === 'frontend-patterns');
  assert(!/Load this first/i.test(fe.instruction), 'not-installed must not say Load this first');
  assert(/NOT INSTALLED/.test(fe.instruction), 'should rewrite to install-first');
});

test('buildSkillSuggestions: caps 3, excludes installed + find-skills, ranks ecosystem first', () => {
  const a = classifySkills(PLAN, DISCOVERY);
  const s = buildSkillSuggestions(a, DISCOVERY, [], 'redesign admin dashboard');
  assert(s.length <= 3);
  assert(!s.some(x => x.name === 'frontend-patterns'), 'installed never suggested');
  assert(!s.some(x => x.name === 'find-skills'), 'find-skills never suggested');
  assert.strictEqual(s[0].name, 'enterprise-ui-architect', 'highest-relevance ecosystem hit first');
  assert(/npx skills add enterprise-ui-architect -g/.test(s[0].install), 'install command present');
});

test('buildSkillSuggestions: respects dismissals', () => {
  const a = classifySkills(PLAN, DISCOVERY);
  const s = buildSkillSuggestions(a, DISCOVERY, ['enterprise-ui-architect'], 'x');
  assert(!s.some(x => x.name === 'enterprise-ui-architect'), 'dismissed skill not suggested');
});

test('rendered prompt: three-state labels + SKILL SUGGESTIONS, no not-installed load-first', () => {
  const r = generatePrompt('redesign the admin dashboard', { discovery: DISCOVERY });
  assert(/\[installed\] frontend-patterns/.test(r.prompt), 'installed labeled');
  assert(/SKILL SUGGESTIONS — approval required/.test(r.prompt), 'suggestions section present');
  assert(!/1\. \[(?:suggested|unverified)\][^\n]*\n[^\n]*Load this first/.test(r.prompt), 'no not-installed load-first');
  assert(r.metadata.skillSuggestions.length > 0, 'suggestions in metadata');
});

test('rendered prompt without discovery: unverified + honest note, no suggestions', () => {
  const r = generatePrompt('redesign the admin dashboard', {});
  assert(/\[unverified\]/.test(r.prompt), 'unverified labels present');
  assert(/Discovery did not run/.test(r.prompt), 'honest degrade note');
});

test('project-config: dismissal persists and is readable', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-cfg-'));
  assert.strictEqual(isDismissed(cwd, 'foo-skill'), false);
  dismissSkill(cwd, 'foo-skill');
  assert.strictEqual(isDismissed(cwd, 'foo-skill'), true, 'dismissal persisted');
  assert(readConfig(cwd).dismissedSkills.includes('foo-skill'));
  const cfg = path.join(cwd, '.prompt-builder', 'config.json');
  assert((fs.statSync(cfg).mode & 0o777) === 0o600, 'config written 0600');
});

console.log('');
