const assert = require('assert');
const { categorizeError, ERROR_CATEGORIES } = require('../scripts/error-handler');

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

console.log('\nError Handler Tests');

test('categorizes timeout-like errors without global classes', () => {
  const error = new Error('Connection timeout');
  const result = categorizeError(error);
  assert.strictEqual(result.category, ERROR_CATEGORIES.TRANSIENT);
  assert.strictEqual(result.isRetryable, true);
});

test('categorizes permission-like errors without global classes', () => {
  const error = new Error('Permission denied');
  const result = categorizeError(error);
  assert.strictEqual(result.category, ERROR_CATEGORIES.PERMISSION);
  assert.strictEqual(result.isRetryable, false);
});

test('categorizes validation errors', () => {
  const result = categorizeError(new TypeError('Invalid parameter'));
  assert.strictEqual(result.category, ERROR_CATEGORIES.VALIDATION);
});

console.log('');
