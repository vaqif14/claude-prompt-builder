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

console.log('');
