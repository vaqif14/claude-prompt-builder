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

// Regression: \b must not drop suffixed framework names
test('detectStack resolves nextjs (not general) for "upgrade nextjs"', () => {
  assert.strictEqual(detectStack('upgrade nextjs'), 'nextjs');
});

test('detectStack resolves nestjs for "nestjs module"', () => {
  assert.strictEqual(detectStack('nestjs module'), 'nestjs');
});

test('detectStack does NOT mistake "email validation" for ai-app', () => {
  assert.notStrictEqual(detectStack('email validation'), 'ai-app');
});

// Regression: detectPlatforms must use word boundaries too (not just detectStack)
test('detectPlatforms: "main page" is NOT ai (ai⊂main)', () => {
  const ids = detectPlatforms('main page').map(p => p.id);
  assert(!ids.includes('ai'), `unexpected ai lane: ${ids}`);
  assert(ids.includes('web'), 'should still detect web');
});

test('detectPlatforms: "retail dashboard" is NOT ai (ai⊂retail)', () => {
  assert(!detectPlatforms('retail dashboard').map(p => p.id).includes('ai'));
});

test('detectPlatforms: "rusty old button" is NOT rust (rust⊂rusty)', () => {
  assert(!detectPlatforms('rusty old button').map(p => p.id).includes('rust'));
});

test('detectPlatforms guard: real signals still detected', () => {
  assert(detectPlatforms('rust axum service').map(p => p.id).includes('rust'));
  assert(detectPlatforms('build an ai rag agent').map(p => p.id).includes('ai'));
  assert(detectPlatforms('react component').map(p => p.id).includes('web'));
});

test('detectPlatformsMixed: single-platform task gets no spurious integration lane', () => {
  const ids = detectPlatformsMixed('bidder product list main page').map(p => p.id);
  assert(!ids.includes('integration'), `spurious integration lane: ${ids}`);
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
