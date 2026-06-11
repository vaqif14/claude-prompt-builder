const assert = require('assert');
const { selectWorkflowPattern, listPatterns, PATTERNS } = require('../src/workflow-router');

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

console.log('\nWorkflow Router Tests');

test('read-only review modes → parallel-review', () => {
  for (const mode of ['audit', 'design-review', 'security-review', 'architecture-review', 'performance-review', 'agent-readiness', 'tooling-review', 'skill-review']) {
    const r = selectWorkflowPattern({ mode, complexity: 'Medium', platforms: [{ id: 'web' }] });
    assert.strictEqual(r.pattern, 'parallel-review', `${mode} should be parallel-review`);
  }
});

test('bugfix → evaluator-optimizer', () => {
  assert.strictEqual(selectWorkflowPattern({ mode: 'bugfix' }).pattern, 'evaluator-optimizer');
});

test('refactor → prompt-chain', () => {
  assert.strictEqual(selectWorkflowPattern({ mode: 'refactor' }).pattern, 'prompt-chain');
});

test('prd-to-tasks → routing', () => {
  assert.strictEqual(selectWorkflowPattern({ mode: 'prd-to-tasks' }).pattern, 'routing');
});

test('multi-surface feature → orchestrator-workers', () => {
  const r = selectWorkflowPattern({ mode: 'feature', platforms: [{ id: 'web' }, { id: 'backend' }] });
  assert.strictEqual(r.pattern, 'orchestrator-workers');
});

test('high complexity feature → orchestrator-workers', () => {
  const r = selectWorkflowPattern({ mode: 'feature', complexity: 'High', platforms: [{ id: 'web' }] });
  assert.strictEqual(r.pattern, 'orchestrator-workers');
});

test('hackathon → orchestrator-workers', () => {
  assert.strictEqual(selectWorkflowPattern({ mode: 'hackathon' }).pattern, 'orchestrator-workers');
});

test('simple single-surface feature → single-pass', () => {
  const r = selectWorkflowPattern({ mode: 'feature', complexity: 'Low', platforms: [{ id: 'web' }], agentCount: 2 });
  assert.strictEqual(r.pattern, 'single-pass');
});

test('explicit autonomous intent → autonomous-loop (overrides mode)', () => {
  const r = selectWorkflowPattern({ mode: 'feature', task: 'build an autonomous agent that runs in a loop' });
  assert.strictEqual(r.pattern, 'autonomous-loop');
});

test('every pattern has a non-empty description; selection carries rationale', () => {
  for (const key of listPatterns()) {
    assert(PATTERNS[key] && PATTERNS[key].length > 10, `pattern ${key} needs a description`);
  }
  const r = selectWorkflowPattern({ mode: 'feature' });
  assert(r.rationale && r.rationale.length > 10, 'selection must carry a rationale');
  assert(r.description, 'selection must carry a description');
});

console.log('');
