const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generatePrompt, listModes } = require('../src');
const { validatePrompt } = require('../scripts/validate');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (error) { console.log(`  ❌ ${name}`); console.log(`     ${error.message}`); process.exitCode = 1; }
}

function tempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pb-contract-'));
}

console.log('\nPrompt Contract Tests');

test('all modes receive the correct fresh-evidence contract', () => {
  for (const mode of listModes()) {
    const result = generatePrompt('perform requested work', { mode: mode.key, stackProfile: false });
    if (result.metadata.readOnly) {
      assert(result.prompt.includes('NO VERDICT WITHOUT FRESH FINDINGS EVIDENCE'), mode.key);
    } else {
      assert(result.prompt.includes('NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE'), mode.key);
    }
  }
});

test('exploration renders immediately before grounding', () => {
  const prompt = generatePrompt('add a timer', { stackProfile: false }).prompt;
  assert(prompt.indexOf('EXPLORATION CONTRACT') < prompt.indexOf('GROUNDING CONTRACT'));
});

test('Gradle evidence table uses the grounded wrapper command', () => {
  const cwd = tempRepo();
  fs.writeFileSync(path.join(cwd, 'build.gradle'), 'plugins { id "java" }\n');
  fs.writeFileSync(path.join(cwd, 'gradlew'), '#!/bin/sh\n');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src', 'PaymentService.java'), 'class PaymentService {}\n');
  const prompt = generatePrompt('fix payment service bug', { cwd, stackProfile: false }).prompt;
  assert(prompt.includes('`./gradlew test` output with exit 0'));
});

test('missing test command is represented honestly', () => {
  const prompt = generatePrompt('add a timer', { cwd: tempRepo(), stackProfile: false }).prompt;
  assert(prompt.includes('test command not detected; resolve before claim'));
});

test('subagent protocol is conditional', () => {
  const parallel = generatePrompt('audit auth flow', { mode: 'security-review', stackProfile: false }).prompt;
  const single = generatePrompt('add a timer', { mode: 'feature', stackProfile: false }).prompt;
  assert(parallel.includes('Subagent Dispatch Protocol'));
  assert(!single.includes('Subagent Dispatch Protocol'));
});

test('write plans require file map and expose structured diagnostics', () => {
  const prompt = generatePrompt('add a timer', { stackProfile: false }).prompt;
  assert(prompt.includes('FILE MAP'));
  const malformed = prompt.replace(/FILE MAP[^\n]*/g, 'REMOVED MAP');
  const validation = validatePrompt(malformed);
  assert(validation.diagnostics.some(item => item.code === 'missing-file-map'));
});

test('contract text is loaded from a custom data directory', () => {
  const dataDir = tempRepo();
  fs.cpSync(path.join(__dirname, '..', 'data'), dataDir, { recursive: true });
  fs.appendFileSync(path.join(dataDir, 'contracts', 'exploration.md'), '\nFixture exploration rule.');
  const prompt = generatePrompt('add a timer', { dataDir, stackProfile: false }).prompt;
  assert(prompt.includes('Fixture exploration rule.'));
});

console.log('');
