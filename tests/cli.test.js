const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (error) { console.log(`  ❌ ${name}`); console.log(`     ${error.message}`); process.exitCode = 1; }
}

const root = path.join(__dirname, '..');

function run(args, home) {
  return spawnSync(process.execPath, ['bin/prompt-builder.js', ...args], {
    cwd: root,
    env: { ...process.env, HOME: home, NO_COLOR: '1' },
    encoding: 'utf8',
  });
}

console.log('\nCLI Tests');

test('unknown flags and invalid values exit non-zero', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-cli-'));
  assert.notStrictEqual(run(['--wat'], home).status, 0);
  assert.notStrictEqual(run(['--max-tokens', 'nope', 'task'], home).status, 0);
  assert.notStrictEqual(run(['--mode', 'missing', 'task'], home).status, 0);
});

test('stats, outcome, and feedback commands round-trip with JSON output', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-cli-'));
  const generated = run(['--compact', '--no-discover', '--no-stack-cache', 'add timer'], home);
  assert.strictEqual(generated.status, 0, generated.stderr);
  const index = JSON.parse(fs.readFileSync(path.join(home, '.prompt-builder', 'index.json'), 'utf8'));
  const id = index.sessions[0].id;
  const outcome = run(['--json', '--record-outcome', id, 'success', 'works'], home);
  assert.strictEqual(outcome.status, 0, outcome.stderr);
  assert.strictEqual(JSON.parse(outcome.stdout).outcome, 'success');
  const stats = JSON.parse(run(['--json', '--stats'], home).stdout);
  assert.strictEqual(stats.outcomes.success, 1);
  const feedback = JSON.parse(run(['--json', '--feedback-report'], home).stdout);
  assert(feedback.note.includes('never modifies templates'));
});

test('trust details scans an installed local skill', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-cli-'));
  const dir = path.join(home, '.claude', 'skills', 'benign');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: benign\ndescription: test\n---\n# Benign\n');
  const result = run(['--json', '--trust-details', 'benign'], home);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(JSON.parse(result.stdout).risk, 'low');
});

console.log('');
