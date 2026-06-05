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

test('default prompt stays within the 3500 token budget', () => {
  const result = generatePrompt('review admin dashboard and confirm all working');
  assert(estimateTokens(result.prompt) <= 3500, `Expected <=3500 tokens, got ${estimateTokens(result.prompt)}`);
  assert(result.validation.score >= 90, `Expected strong validation score, got ${result.validation.score}`);
});

test('full option disables token compression', () => {
  const compact = generatePrompt('review admin dashboard and confirm all working');
  const full = generatePrompt('review admin dashboard and confirm all working', { full: true });
  assert(estimateTokens(full.prompt) > estimateTokens(compact.prompt), 'Expected full prompt to be larger than compact prompt');
});

console.log('');
