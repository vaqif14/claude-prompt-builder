const assert = require('assert');
const { RUBRIC, buildQualityBar, assessPromptQuality } = require('../src/quality-rubric');

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

console.log('\nQuality Rubric Tests');

test('rubric covers the six dev-metrics dimensions', () => {
  const keys = RUBRIC.map(d => d.key).sort();
  assert.deepStrictEqual(keys, [
    'context_provision', 'prompt_quality', 'response_quality',
    'task_clarity', 'tool_utilization', 'verification_rigor',
  ].sort());
  for (const d of RUBRIC) assert(d.target && d.signals.length, `${d.key} needs target + signals`);
});

test('QUALITY BAR section names verification + tool use as weak spots', () => {
  const bar = buildQualityBar(false).join('\n');
  assert(/QUALITY BAR/.test(bar));
  assert(/Verification \(the weak spot\)/.test(bar));
  assert(/Tool use \(the weak spot\)/.test(bar));
});

test('assess flags gaps on a bare prompt', () => {
  const r = assessPromptQuality('do the thing');
  assert(r.covered < r.total, 'a bare prompt should not cover all dimensions');
  assert(r.gaps.length > 0, 'should list gaps');
  assert.strictEqual(r.total, 6);
});

test('assess credits a rubric-rich prompt', () => {
  const rich = [
    'expected vs actual stated', 'hypothesis: parseEmail()', 'already tried URLEncoder',
    'why it matters: blocks checkout', 'related systems: OAuth', 'tests to verify: AuthTest',
    'non-goals: no server-side', 'edge cases: + in local part', 'acceptance: green suite',
    'read the diff', 'check side-effects and regressions', 'catch silent failures',
    'VERIFICATION CONTRACT', 'use parallel sub-agents', 'plan mode', 'update CLAUDE.md memory',
    'answer clarifications and anticipate follow-ups',
  ].join('\n');
  const r = assessPromptQuality(rich);
  assert.strictEqual(r.covered, 6, `expected full coverage, got ${r.covered}: ${JSON.stringify(r.gaps)}`);
  assert.strictEqual(r.weakest, null);
});

console.log('');
