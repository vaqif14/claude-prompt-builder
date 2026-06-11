const assert = require('assert');
const { inferMode, getModeConfig, listModes, MODES } = require('../src/mode-router');

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

console.log('\nMode Router Tests');

test('inferMode detects audit from "review"', () => {
  assert.strictEqual(inferMode('review admin dashboard'), 'audit');
});

test('inferMode detects bugfix from "fix"', () => {
  assert.strictEqual(inferMode('fix login bug'), 'bugfix');
});

test('inferMode detects design-review from keyword', () => {
  assert.strictEqual(inferMode('design review checkout'), 'design-review');
});

test('inferMode detects security-review from keyword', () => {
  assert.strictEqual(inferMode('security review auth flow'), 'security-review');
});

test('inferMode detects performance-review from keyword', () => {
  assert.strictEqual(inferMode('why is this slow'), 'performance-review');
});

test('inferMode detects release-check from keyword', () => {
  assert.strictEqual(inferMode('ready to deploy'), 'release-check');
});

test('inferMode detects prd-to-tasks from keyword', () => {
  assert.strictEqual(inferMode('break this PRD into tasks'), 'prd-to-tasks');
});

test('inferMode defaults to feature', () => {
  assert.strictEqual(inferMode('add new timer'), 'feature');
});

test('explicit mode overrides inference', () => {
  assert.strictEqual(inferMode('add new timer', 'audit'), 'audit');
});

test('getModeConfig returns config for all modes', () => {
  for (const key of Object.keys(MODES)) {
    const config = getModeConfig(key);
    assert(config.label, `Mode ${key} missing label`);
    assert(config.authority, `Mode ${key} missing authority`);
    assert(config.subTasks.length > 0, `Mode ${key} missing subTasks`);
    assert(config.acceptanceCriteria.length > 0, `Mode ${key} missing acceptanceCriteria`);
    assert(config.toolPermissions.length > 0, `Mode ${key} missing toolPermissions`);
    assert(config.outputSchema.length > 0, `Mode ${key} missing outputSchema`);
  }
});

test('listModes returns all modes', () => {
  const modes = listModes();
  assert.strictEqual(modes.length, Object.keys(MODES).length);
});

// Regression: word-boundary keyword matching (substring no longer misroutes)
test('inferMode: "implement checkout flow" is feature, not audit (check⊂checkout)', () => {
  assert.strictEqual(inferMode('implement checkout flow'), 'feature');
});

test('inferMode: "add checkbox to form" is feature (check⊂checkbox)', () => {
  assert.strictEqual(inferMode('add checkbox to form'), 'feature');
});

test('inferMode: "build a workspace switcher" is feature (works⊂workspace)', () => {
  assert.strictEqual(inferMode('build a workspace switcher'), 'feature');
});

test('inferMode: "create works order tracker" is feature, not audit', () => {
  assert.strictEqual(inferMode('create works order tracker'), 'feature');
});

test('inferMode guard: "review admin dashboard" still audit', () => {
  assert.strictEqual(inferMode('review admin dashboard'), 'audit');
});

test('inferMode guard: "confirm all working" still audit', () => {
  assert.strictEqual(inferMode('confirm that all working'), 'audit');
});

test('inferMode guard: "fix failing crash" still bugfix (fail suffix kept)', () => {
  assert.strictEqual(inferMode('fix failing tests'), 'bugfix');
});

// Regression: design-review co-occurrence (word order independent)
test('inferMode: "visual design audit" is design-review (not generic audit)', () => {
  assert.strictEqual(inferMode('visual design audit'), 'design-review');
});

test('inferMode: "audit the ui design" is design-review', () => {
  assert.strictEqual(inferMode('audit the ui design'), 'design-review');
});

test('inferMode: "design review checkout" still design-review', () => {
  assert.strictEqual(inferMode('design review checkout'), 'design-review');
});

test('inferMode guard: "review admin dashboard" stays audit (no design token)', () => {
  assert.strictEqual(inferMode('review admin dashboard'), 'audit');
});

// Quality-vs-bug guard: "fix code quality / best practice" is refactor, not bugfix
test('inferMode: "backend code quality is weak, fix best-practice deviations" is refactor', () => {
  assert.strictEqual(inferMode('backend code quality is weak, fix best-practice deviations'), 'refactor');
});

test('inferMode: "clean up technical debt" is refactor', () => {
  assert.strictEqual(inferMode('clean up technical debt'), 'refactor');
});

test('inferMode guard: "fix login crash" stays bugfix (acute bug beats quality guard)', () => {
  assert.strictEqual(inferMode('fix login crash'), 'bugfix');
});

test('inferMode guard: "fix the failing payment bug" stays bugfix', () => {
  assert.strictEqual(inferMode('fix the failing payment bug'), 'bugfix');
});

// v1.10.0 new modes
test('inferMode detects hackathon from "mvp"/"demo"/"hackathon"', () => {
  assert.strictEqual(inferMode('build an mvp for the hackathon demo'), 'hackathon');
});

test('inferMode detects agent-readiness from ".claude" / "CLAUDE.md"', () => {
  assert.strictEqual(inferMode('audit our .claude setup and CLAUDE.md'), 'agent-readiness');
});

test('inferMode detects tooling-review from "mcp readiness" / "tool overload"', () => {
  assert.strictEqual(inferMode('check our mcp readiness and tool overload'), 'tooling-review');
});

test('inferMode detects skill-review from "review this skill"', () => {
  assert.strictEqual(inferMode('review this skill for bloat'), 'skill-review');
});

test('inferMode ordering: "skill review" is skill-review, not audit', () => {
  assert.strictEqual(inferMode('skill review'), 'skill-review');
});

console.log('');
