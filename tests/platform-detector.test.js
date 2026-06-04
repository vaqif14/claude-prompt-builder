const assert = require('assert');
const { detectPlatforms, detectPlatformsMixed, detectStack, PLATFORM_REGISTRY } = require('../src/platform-detector');

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

console.log('\nPlatform Detector Tests');

test('detects web from "react component"', () => {
  const ps = detectPlatforms('create react component');
  assert(ps.some(p => p.id === 'web'));
});

test('detects backend from "spring boot api"', () => {
  const ps = detectPlatforms('spring boot api');
  assert(ps.some(p => p.id === 'backend'));
});

test('detects ios from "swiftui screen"', () => {
  const ps = detectPlatforms('swiftui screen');
  assert(ps.some(p => p.id === 'ios'));
});

test('detects android from "jetpack compose"', () => {
  const ps = detectPlatforms('jetpack compose login');
  assert(ps.some(p => p.id === 'android'));
});

test('detects go from "golang service"', () => {
  const ps = detectPlatforms('golang service');
  assert(ps.some(p => p.id === 'go'));
});

test('does NOT detect go from "login bug"', () => {
  const ps = detectPlatforms('fix login bug');
  assert(!ps.some(p => p.id === 'go'));
});

test('detects python from "fastapi endpoint"', () => {
  const ps = detectPlatforms('fastapi endpoint');
  assert(ps.some(p => p.id === 'python'));
});

test('detects rust from "cargo build"', () => {
  const ps = detectPlatforms('cargo build');
  assert(ps.some(p => p.id === 'rust'));
});

test('mixed platform creates integration lane', () => {
  const ps = detectPlatformsMixed('ios app with backend api');
  assert(ps.some(p => p.id === 'ios'));
  assert(ps.some(p => p.id === 'backend'));
  assert(ps.some(p => p.id === 'integration'));
});

test('detectStack returns nextjs for react', () => {
  assert.strictEqual(detectStack('react component'), 'nextjs');
});

test('detectStack returns general for unknown', () => {
  assert.strictEqual(detectStack('do something'), 'general');
});

test('all platforms have required fields', () => {
  for (const p of PLATFORM_REGISTRY) {
    assert(p.id, `Platform missing id`);
    assert(p.label, `Platform ${p.id} missing label`);
    assert(p.keywords, `Platform ${p.id} missing keywords`);
    assert(p.defaultSkills.length > 0, `Platform ${p.id} missing defaultSkills`);
    assert(p.evidence, `Platform ${p.id} missing evidence`);
  }
});

console.log('');
