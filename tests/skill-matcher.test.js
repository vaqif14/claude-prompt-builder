const assert = require('assert');
const {
  analyzeTask,
  getSkillInvocationPlan,
  getAgentCouncil,
  getMulticaStyleTaskBoard,
  getUniversalAgentRoster,
  getSkillDiscoveryProtocol,
} = require('../src/skill-matcher');
const { detectPlatformsMixed } = require('../src/platform-detector');

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

// Platform-aware council: a native-mobile task must get a mobile reviewer + simulator QA,
// NOT a web "Frontend/Web Code Reviewer" or "Browser QA Engineer".
const platformCouncilRoles = (task, mode = 'audit') =>
  getAgentCouncil(task, mode, 'Medium', {}, { isUi: true }, detectPlatformsMixed(task)).map((a) => a.name);

test('getAgentCouncil: SwiftUI audit gets iOS/Swift Reviewer + Device/Simulator QA, not browser', () => {
  const roles = platformCouncilRoles('review the swiftui login screen and confirm all working');
  assert(roles.includes('iOS/Swift Reviewer'), `missing iOS reviewer; got: ${roles.join(', ')}`);
  assert(roles.includes('Device/Simulator QA Engineer'), `missing simulator QA; got: ${roles.join(', ')}`);
  assert(!roles.includes('Browser QA Engineer'), 'native mobile must not use Browser QA');
  assert(!roles.includes('Frontend/Web Code Reviewer'), 'native mobile must not use the web reviewer');
});

test('getAgentCouncil: Android audit gets Android/Kotlin Reviewer', () => {
  assert(platformCouncilRoles('audit the android jetpack compose screen').includes('Android/Kotlin Reviewer'));
});

test('getAgentCouncil: devops task gets DevOps/Release Reviewer', () => {
  assert(platformCouncilRoles('review the docker deploy pipeline').includes('DevOps/Release Reviewer'));
});

test('getAgentCouncil: web audit still gets Browser QA Engineer (not simulator)', () => {
  const roles = platformCouncilRoles('audit the nextjs dashboard and confirm all working');
  assert(roles.includes('Browser QA Engineer'), `web should keep Browser QA; got: ${roles.join(', ')}`);
  assert(!roles.includes('Device/Simulator QA Engineer'), 'web must not use simulator QA');
});

// Agent -> skill binding: every agent card/roster entry owns a specific skill
test('task board binds a skill to every card; backend card gets a backend skill', () => {
  const platforms = detectPlatformsMixed('spring boot backend api service');
  const board = getMulticaStyleTaskBoard('review spring boot api', 'audit', platforms);
  for (const c of board) assert(c.skill && c.skill.length, `card ${c.id} (${c.owner}) missing skill`);
  const backendCard = board.find(c => /Backend/.test(c.owner));
  assert(backendCard, `expected a Backend agent card; owners: ${board.map(c => c.owner).join(' / ')}`);
  assert(backendCard.skill && backendCard.skill !== 'find-skills', `backend card skill not bound to a backend skill: ${backendCard.skill}`);
});

test('universal roster binds a skill to every agent', () => {
  const platforms = detectPlatformsMixed('spring boot backend api');
  const roster = getUniversalAgentRoster('review api', 'audit', platforms, 'Medium', {});
  for (const a of roster) assert(a.skill && a.skill.length, `agent ${a.role} missing skill`);
});

// Depth signals keep refactor/security/perf tasks off the cheapest model tier
test('analyzeTask: a refactor task is at least Medium complexity (not Low)', () => {
  assert.notStrictEqual(analyzeTask('refactor backend service for best practices').complexity, 'Low');
});

test('analyzeTask: a security review is at least Medium complexity', () => {
  assert.notStrictEqual(analyzeTask('security review of the auth flow').complexity, 'Low');
});

// Trusted-source internet discovery appears when no cached profile exists
test('skill discovery protocol restricts internet research to trusted sources', () => {
  const proto = getSkillDiscoveryProtocol('review api', [], [], 'spring-boot', null).join('\n');
  assert(/trusted sources/i.test(proto), 'expected trusted-source guidance');
  assert(/github/i.test(proto) && /x\.com/i.test(proto) && /npm registry/i.test(proto), 'expected github/x.com/npm trusted sources');
});

console.log('');
