const assert = require('assert');
const { getInstallProfile, listInstallProfiles, MAX_ITEMS, PROFILES } = require('../src/install-profiles');

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

console.log('\nInstall Profiles Tests');

test('known profile returns label + items', () => {
  const p = getInstallProfile('web');
  assert(p && p.label, 'web profile should exist');
  assert(p.items.length > 0, 'web profile should have items');
  assert(p.items.every(i => i.name && i.why), 'every item needs a name and a why');
});

test('profile lookup is case-insensitive', () => {
  assert(getInstallProfile('WEB'));
  assert(getInstallProfile('AI-Agent'));
});

test('unknown profile returns null', () => {
  assert.strictEqual(getInstallProfile('does-not-exist'), null);
  assert.strictEqual(getInstallProfile(''), null);
  assert.strictEqual(getInstallProfile(undefined), null);
});

test('every profile is capped at MAX_ITEMS', () => {
  for (const key of listInstallProfiles()) {
    assert(getInstallProfile(key).items.length <= MAX_ITEMS, `${key} exceeds cap`);
  }
});

test('listInstallProfiles matches the PROFILES keys', () => {
  assert.deepStrictEqual(listInstallProfiles().sort(), Object.keys(PROFILES).sort());
});

console.log('');
