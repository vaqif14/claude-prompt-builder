const assert = require('assert');
const { scoreContextDiet } = require('../src/context-diet');

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

const sections = (specs) => specs.map(([name, lines]) => ({ name, lines }));
const filler = (n) => Array.from({ length: n }, (_, i) => `  • line ${i} of padding content to add tokens`);

console.log('\nContext Diet Tests');

test('lean grade for a small prompt under 60% of budget', () => {
  const r = scoreContextDiet(sections([['SYSTEM CONTRACT', filler(10)], ['OUTPUT SCHEMA', filler(10)]]), { maxTokens: 6000, stackProfileStatus: 'hit' });
  assert.strictEqual(r.grade, 'lean');
  assert(r.estTokens > 0);
  assert.strictEqual(r.sectionCount, 2);
});

test('heavy grade + over-budget warning when prompt exceeds budget', () => {
  const r = scoreContextDiet(sections([['CONTEXT WINDOW', filler(4000)]]), { maxTokens: 6000, stackProfileStatus: 'hit' });
  assert.strictEqual(r.grade, 'heavy');
  assert(r.warnings.some(w => /exceeds budget/.test(w)), 'should warn about exceeding budget');
});

test('oversized single section produces a bloat warning', () => {
  const r = scoreContextDiet(sections([['SKILL DISCOVERY PREFLIGHT', filler(1200)]]), { maxTokens: 60000, stackProfileStatus: 'hit' });
  assert(r.warnings.some(w => /is \d+t — large/.test(w)), 'should warn about an oversized section');
});

test('missing stack profile warns about repeated discovery', () => {
  const r = scoreContextDiet(sections([['SYSTEM CONTRACT', filler(5)]]), { maxTokens: 6000, stackProfileStatus: null });
  assert(r.warnings.some(w => /No stack-profile cache/.test(w)));
});

test('recommendedMaxTokens fits the prompt and is capped at 8000', () => {
  const r = scoreContextDiet(sections([['X', filler(10000)]]), { maxTokens: 6000, stackProfileStatus: 'hit' });
  assert.strictEqual(r.recommendedMaxTokens, 8000);
});

test('counts tool/skill/agent sections', () => {
  const r = scoreContextDiet(sections([
    ['SKILL DISCOVERY PREFLIGHT', filler(2)], ['MATCHED SKILLS', filler(2)],
    ['MULTI-AGENT TASK BOARD', filler(2)], ['AGENT REVIEW COUNCIL', filler(2)],
    ['TOOL DIRECTIVES', filler(2)], ['WORKFLOW PATTERN', filler(2)], ['SYSTEM CONTRACT', filler(2)],
  ]), { maxTokens: 60000, stackProfileStatus: 'hit' });
  assert.strictEqual(r.toolSkillSections, 6);
});

console.log('');
