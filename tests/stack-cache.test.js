const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generatePrompt } = require('../src/index');

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

console.log('\nStack Cache Tests');

test('platform override affects platform and stack detection', () => {
  const result = generatePrompt('review login screen', { platform: 'ios' });
  assert(result.metadata.platforms.includes('ios'), `Expected ios platform, got ${result.metadata.platforms.join(', ')}`);
  assert.strictEqual(result.metadata.stack, 'ios-swift');
});

test('stack profile is created once then reused', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-builder-stack-'));

  const first = generatePrompt('review SwiftUI checkout screen', {
    cwd,
    stackProfile: true,
  });

  assert(first.metadata.stackProfile, 'Expected stack profile metadata');
  assert.strictEqual(first.metadata.stackProfile.status, 'created');
  assert(fs.existsSync(path.join(cwd, first.metadata.stackProfile.path)), 'Expected profile file to exist');
  assert(first.prompt.includes('Stack profile cache: MISS -> CREATED'), 'Expected created cache protocol');

  const second = generatePrompt('review SwiftUI checkout screen', {
    cwd,
    stackProfile: true,
  });

  assert.strictEqual(second.metadata.stackProfile.status, 'hit');
  assert(second.prompt.includes('Stack profile cache: HIT'), 'Expected cache hit protocol');
  assert(second.prompt.includes('Do not repeat broad local skill scans'), 'Expected repeated discovery to be skipped');
});

console.log('');
