const assert = require('assert');
const { generatePrompt } = require('../src/index');
const { validatePrompt } = require('../scripts/validate');

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

console.log('\nEnd-to-End Tests');

const TEST_CASES = [
  {
    name: 'review admin dashboard',
    task: 'review admin dashboard and confirm that all working',
    expectedMode: 'audit',
    expectedPlatforms: ['web'],
  },
  {
    name: 'SwiftUI checkout screen',
    task: 'review SwiftUI checkout screen',
    expectedMode: 'audit',
    expectedPlatforms: ['ios'],
  },
  {
    name: 'Android Kotlin Compose login',
    task: 'fix Android Kotlin Compose login flow',
    expectedMode: 'bugfix',
    expectedPlatforms: ['android'],
  },
  {
    name: 'RAG agent app memory',
    task: 'audit RAG agent app memory persistence',
    expectedMode: 'audit',
    expectedPlatforms: ['ai'],
  },
  {
    name: 'design auction card',
    task: 'design auction card component',
    expectedMode: 'feature',
    expectedPlatforms: ['web'],
  },
  {
    name: 'mobile + backend mixed',
    task: 'ios app with backend api',
    expectedMode: 'feature',
    expectedPlatforms: ['ios', 'backend', 'integration'],
  },
  {
    name: 'design-review mode',
    task: 'review checkout screen design',
    options: { mode: 'design-review' },
    expectedMode: 'design-review',
    expectedPlatforms: ['general'],
  },
  {
    name: 'security-review mode',
    task: 'audit auth flow security',
    options: { mode: 'security-review' },
    expectedMode: 'security-review',
    expectedPlatforms: ['general'],
  },
];

for (const tc of TEST_CASES) {
  test(`${tc.name}: generates prompt`, () => {
    const result = generatePrompt(tc.task, tc.options || {});
    assert(result.prompt.length > 500, 'Prompt too short');
    assert(result.metadata.mode === tc.expectedMode,
      `Expected mode ${tc.expectedMode}, got ${result.metadata.mode}`);

    for (const expected of tc.expectedPlatforms) {
      assert(result.metadata.platforms.includes(expected),
        `Expected platform ${expected}, got ${result.metadata.platforms.join(', ')}`);
    }
  });

  test(`${tc.name}: validation passes (≥80)`, () => {
    const result = generatePrompt(tc.task, tc.options || {});
    const v = validatePrompt(result.prompt);
    assert(v.score >= 80,
      `Validation score ${v.score} < 80. Grade: ${v.grade}. Failed: ${v.checks.filter(c => !c.pass).map(c => c.label).join(', ')}`);
  });
}

test('all prompts have no [stack] placeholder', () => {
  for (const tc of TEST_CASES) {
    const result = generatePrompt(tc.task, tc.options || {});
    assert(!result.prompt.includes('[stack]'),
      `[stack] placeholder found in "${tc.name}"`);
  }
});

test('every prompt carries a PROBLEM ANALYSIS diagnostic center', () => {
  for (const tc of TEST_CASES) {
    const result = generatePrompt(tc.task, tc.options || {});
    assert(/PROBLEM ANALYSIS/.test(result.prompt), `PROBLEM ANALYSIS missing in "${tc.name}"`);
    assert(/<RESOLVE/.test(result.prompt), `expected <RESOLVE> slots in "${tc.name}"`);
  }
});

test('unfilled CLI scaffold reports solutionReadiness=draft (the 100/100 is not "done")', () => {
  const result = generatePrompt('refactor the payment service', {});
  const v = validatePrompt(result.prompt);
  assert.strictEqual(v.solutionReadiness, 'draft',
    `expected draft (unfilled <RESOLVE>), got ${v.solutionReadiness}`);
});

test('every prompt carries a spec-kit-style TASK PLAN with task rows', () => {
  for (const tc of TEST_CASES) {
    const result = generatePrompt(tc.task, tc.options || {});
    assert(/TASK PLAN/.test(result.prompt), `TASK PLAN missing in "${tc.name}"`);
    assert(/\b[TF]\d{2,3}\b/.test(result.prompt), `no task/finding rows in "${tc.name}"`);
  }
});

test('refactor task plan = edit tasks (depends_on); audit task plan = findings ledger (evidence)', () => {
  const refactor = generatePrompt('refactor the payment service', {}).prompt;
  const planR = refactor.slice(refactor.search(/TASK PLAN/));
  assert(/T001/.test(planR) && /depends_on:/.test(planR), 'refactor plan should have T-rows + depends_on');

  const audit = generatePrompt('audit the dashboard and confirm all working', {}).prompt;
  const planA = audit.slice(audit.search(/TASK PLAN/));
  assert(/F001/.test(planA) && /evidence:/.test(planA), 'audit plan should be a findings ledger (F-rows + evidence)');
});

test('feature mode prepends a US/FR/SC spec micro-block', () => {
  const p = generatePrompt('add a saved-search feature', {}).prompt;
  assert(/User stories:/.test(p) && /FR-001/.test(p) && /SC-001/.test(p), 'feature spec micro-block missing');
});

test('unfilled TASK PLAN reports planReadiness=draft; overall readiness draft', () => {
  const v = validatePrompt(generatePrompt('refactor the payment service', {}).prompt);
  assert.strictEqual(v.planReadiness, 'draft', `expected plan draft, got ${v.planReadiness}`);
  assert.strictEqual(v.readiness, 'draft');
});

test('filled diagnosis + filled plan → planReadiness=ready and overall ready', () => {
  let p = generatePrompt('refactor the payment service', {}).prompt;
  p = p.replace(/<RESOLVE[^>]*>/g, 'src/PaymentService.java:142 — duplicated retry; extract retry() (PaymentServiceTest green)');
  const v = validatePrompt(p);
  assert.strictEqual(v.solutionReadiness, 'ready', `solution: ${v.solutionReadiness}`);
  assert.strictEqual(v.planReadiness, 'ready', `plan: ${v.planReadiness}`);
  assert.strictEqual(v.readiness, 'ready');
});

test('a filled prompt (real path:line, no <RESOLVE>) reports solutionReadiness=ready', () => {
  const result = generatePrompt('refactor the payment service', {});
  // simulate the SKILL filling the diagnostic center after reading the code
  const filled = result.prompt
    .replace(/<RESOLVE[^>]*>/g, 'PaymentService.java:142 — duplicated retry block; extract retry() helper')
    .replace(/PROBLEM ANALYSIS[^\n]*/, 'PROBLEM ANALYSIS (filled) src/PaymentService.java:142');
  const v = validatePrompt(filled);
  assert.strictEqual(v.solutionReadiness, 'ready',
    `expected ready after fill, got ${v.solutionReadiness}`);
});

// v1.10.0 — every prompt carries a workflow pattern and a verification-first contract
test('every prompt names a workflow pattern (section + metadata)', () => {
  for (const tc of TEST_CASES) {
    const result = generatePrompt(tc.task, tc.options || {});
    assert(/WORKFLOW PATTERN/.test(result.prompt), `${tc.task}: missing WORKFLOW PATTERN section`);
    assert(result.metadata.workflowPattern, `${tc.task}: missing workflowPattern metadata`);
  }
});

test('every prompt carries a verification-first contract', () => {
  for (const tc of TEST_CASES) {
    const result = generatePrompt(tc.task, tc.options || {});
    assert(/VERIFICATION CONTRACT/.test(result.prompt), `${tc.task}: missing VERIFICATION CONTRACT`);
    assert(/Provable by command/.test(result.prompt), `${tc.task}: contract missing proof-by-command`);
  }
});

test('audit verdict rule forbids optimistic "Working" without proof', () => {
  const p = generatePrompt('audit the dashboard and confirm all working', {}).prompt;
  assert(/do NOT output "Working"/.test(p), 'audit must gate the Working verdict on proof');
});

test('every prompt reports a context-diet grade in metadata', () => {
  const r = generatePrompt('review admin dashboard and confirm all working', {});
  assert(['lean', 'ok', 'heavy'].includes(r.metadata.contextDiet.grade), 'diet grade present');
  assert(r.metadata.contextDiet.estTokens > 0, 'diet token estimate present');
});

test('every prompt carries the dev-metrics QUALITY BAR and covers all 6 rubric dimensions', () => {
  for (const tc of TEST_CASES) {
    const r = generatePrompt(tc.task, tc.options || {});
    assert(/QUALITY BAR/.test(r.prompt), `${tc.task}: missing QUALITY BAR`);
    assert(/weak spot/.test(r.prompt), `${tc.task}: quality bar must call out the weak spots`);
    assert.strictEqual(r.metadata.qualityRubric.covered, 6, `${tc.task}: rubric ${r.metadata.qualityRubric.covered}/6, gaps ${JSON.stringify(r.metadata.qualityRubric.gaps)}`);
  }
});

test('verification contract carries rubric-10 rigor (read diffs / side-effects / silent failures)', () => {
  const p = generatePrompt('fix the failing payment bug', {}).prompt;
  assert(/read every diff/i.test(p), 'must require reading diffs');
  assert(/side-effects \/ regressions/i.test(p), 'must require side-effect/regression checks');
  assert(/silent failures/i.test(p), 'must require hunting silent failures');
});

test('--profile injects a capped, approval-required SELECTIVE INSTALL PROFILE', () => {
  const r = generatePrompt('add a countdown timer', { profile: 'web' });
  assert(/SELECTIVE INSTALL PROFILE/.test(r.prompt), 'profile section present');
  assert(/approval-required/i.test(r.prompt), 'profile must state approval-required');
  assert.strictEqual(r.metadata.installProfile, 'Web / Frontend');
  // no profile flag → no section
  const none = generatePrompt('add a countdown timer', {});
  assert(!/SELECTIVE INSTALL PROFILE/.test(none.prompt), 'no profile section without --profile');
});

console.log('');
