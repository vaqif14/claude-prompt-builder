const assert = require('assert');
const {
  analyzeTask,
  getSkillInvocationPlan,
  getAgentCouncil,
} = require('../src/skill-matcher');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
    process.exitCode = 1;
  }
}

const domainsOf = (task) => analyzeTask(task).domains.map((d) => d.domain);
const planSkills = (task) =>
  getSkillInvocationPlan(task, 'feature', analyzeTask(task).domains, [], analyzeTask(task).complexity, {}).map((p) => p.skill);
const councilRoles = (task) =>
  getAgentCouncil(task, 'feature', analyzeTask(task).complexity, {}).map((a) => a.name);

console.log('\nSkill Matcher Tests');

// Regression: \b stops substring false positives
test('analyzeTask: "email validation" is NOT ai-app (ai⊂email)', () => {
  assert(!domainsOf('email validation').includes('ai-app'));
});

test('analyzeTask: "show user detail page" is NOT ai-app (ai⊂detail)', () => {
  assert(!domainsOf('show user detail page').includes('ai-app'));
});

test('analyzeTask: "good logo for category" is NOT go-backend (go⊂good/logo)', () => {
  assert(!domainsOf('good logo for category').includes('go-backend'));
});

test('analyzeTask: "fetch latest release" is NOT verification (test⊂latest)', () => {
  assert(!domainsOf('fetch latest release').includes('verification'));
});

test('analyzeTask: "village flag list" is NOT performance (lag⊂flag/village)', () => {
  assert(!domainsOf('village flag list').includes('performance'));
});

// Guards: real signals still detected
test('analyzeTask: "java spring service" still java-backend', () => {
  assert(domainsOf('java spring service').includes('java-backend'));
});

test('analyzeTask: "go module handler" still go-backend', () => {
  assert(domainsOf('go module handler').includes('go-backend'));
});

test('analyzeTask: "build an ai agent" still ai-app', () => {
  assert(domainsOf('build an ai agent').includes('ai-app'));
});

// Plan/council should not bolt QA onto a plain feature task
test('getSkillInvocationPlan for "implement checkout flow" excludes browser-qa', () => {
  const skills = planSkills('implement checkout flow');
  assert(!skills.includes('browser-qa'));
  assert(!skills.includes('verification-loop'));
});

test('getAgentCouncil for "implement checkout flow" excludes Browser QA Engineer', () => {
  assert(!councilRoles('implement checkout flow').includes('Browser QA Engineer'));
});

test('getAgentCouncil guard: "verify all working" includes Browser QA Engineer', () => {
  assert(councilRoles('verify all working').includes('Browser QA Engineer'));
});

console.log('');
