const assert = require('assert');
const { inferMode, inferTemplate, getModeConfig, listModes, MODES } = require('../src/mode-router');

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

test('inferTemplate maps design-review to design-review CSV', () => {
  assert.strictEqual(inferTemplate('review checkout', 'design-review'), 'design-review');
});

console.log('');
