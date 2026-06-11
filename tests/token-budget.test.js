const assert = require('assert');
const { generatePrompt } = require('../src/index');

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

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

console.log('\nToken Budget Tests');

test('default prompt stays within the 6000 token budget', () => {
  // 6000 is the default maxTokens budget; the prompt is intentionally rich (grounding, diagnosis,
  // spec-kit plan, workflow pattern, verification contract, dev-metrics quality bar). context-diet
  // flags anything near the ceiling as "heavy" — the honest guardrail is "within the default budget".
  const result = generatePrompt('review admin dashboard and confirm all working');
  assert(estimateTokens(result.prompt) <= 6000, `Expected <=6000 tokens, got ${estimateTokens(result.prompt)}`);
  assert(result.validation.score >= 90, `Expected strong validation score, got ${result.validation.score}`);
});

test('full option disables token compression', () => {
  const compact = generatePrompt('review admin dashboard and confirm all working', { maxTokens: 1500 });
  const full = generatePrompt('review admin dashboard and confirm all working', { full: true });
  assert(estimateTokens(full.prompt) > estimateTokens(compact.prompt), 'Expected full prompt to be larger than a compressed prompt');
});

console.log('');
