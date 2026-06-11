const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { generatePrompt, validatePrompt } = require('../src/index');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (e) { console.log(`  ❌ ${name}`); console.log(`     ${e.message}`); process.exitCode = 1; }
}

function bigTsx(label) {
  return `export default function ${label}() {\n` +
    Array.from({ length: 60 }, (_, i) => `  const v${i} = ${i}; // ${label} line ${i}`).join('\n') +
    '\n  return null;\n}\n';
}
function ambiguousRepo() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-amb-'));
  fs.mkdirSync(path.join(cwd, 'app'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'app', 'adminpanel.tsx'), bigTsx('AdminPanel'));
  fs.writeFileSync(path.join(cwd, 'app', 'reportsboard.tsx'), bigTsx('ReportsBoard'));
  return cwd;
}

console.log('\nSolution Flow Tests');

test('low-confidence ambiguous task → CLARIFY-FIRST GATE with real paths', () => {
  const cwd = ambiguousRepo();
  const r = generatePrompt('redesign this', { cwd });
  assert(/CLARIFY-FIRST GATE/.test(r.prompt));
  assert(r.metadata.clarify);
  assert(/\n {4}A\) /.test(r.prompt) && /\n {4}B\) /.test(r.prompt));
  assert(/adminpanel\.tsx|reportsboard\.tsx/.test(r.prompt));
  assert(r.prompt.indexOf('CLARIFY-FIRST GATE') < r.prompt.indexOf('PROBLEM ANALYSIS'));
});

test('high-confidence named file → no clarify gate', () => {
  const cwd = ambiguousRepo();
  const r = generatePrompt('redesign the reportsboard component', { cwd });
  assert(!/CLARIFY-FIRST GATE/.test(r.prompt));
  assert.strictEqual(r.metadata.clarify, null);
});

test('validator returns blocking markers with line and section', () => {
  const v = generatePrompt('refactor the payment service', {}).validation;
  assert(Array.isArray(v.blockingMarkers) && v.blockingMarkers.length > 0);
  assert(v.blockingMarkers.every(m => typeof m.line === 'number' && m.section && m.marker));
  assert(v.blockingMarkers.some(m => /PROBLEM ANALYSIS/.test(m.section)));
});

test('filling all RESOLVE markers clears blocking markers', () => {
  const r = generatePrompt('refactor the payment service', {});
  const filled = r.prompt.replace(/<RESOLVE[^>]*>/g, 'src/PaymentService.java:142 — extract retry() helper');
  assert.strictEqual(validatePrompt(filled).blockingMarkers.length, 0);
});

test('--save refuses a draft; --save-draft writes it', () => {
  const cwd = ambiguousRepo();
  const bin = path.join(__dirname, '..', 'bin', 'prompt-builder.js');
  const out = path.join(cwd, 'p.txt');
  let blocked = false;
  try {
    execFileSync('node', [bin, '--no-discover', '--no-stack-cache', '--save', out, 'add a timer'], { cwd, stdio: 'pipe' });
  } catch (e) {
    blocked = true;
    assert(/DRAFT/.test(String(e.stderr || '')));
  }
  assert(blocked);
  assert(!fs.existsSync(out));
  execFileSync('node', [bin, '--no-discover', '--no-stack-cache', '--save-draft', out, 'add a timer'], { cwd, stdio: 'pipe' });
  assert(fs.existsSync(out));
});

test('output schema leads with solution table or findings ledger', () => {
  assert(/SOLUTION TABLE — one row per edit: `file:line → current → change → why`/.test(generatePrompt('add a timer', {}).prompt));
  assert(/FINDINGS LEDGER table/.test(generatePrompt('review the dashboard and confirm all working', {}).prompt));
});

test('skill invocation gate order is explicit', () => {
  const cwd = ambiguousRepo();
  const discovery = {
    status: 'ok', reason: null, fromCache: false, installed: [],
    available: [{ name: 'ui-ux-pro-max', description: 'visual review', query: 'ui ux design review', relevance: 0.9, status: 'available' }],
    unavailable: [],
  };
  const r = generatePrompt('redesign this', { cwd, discovery });
  assert(/GATE ORDER:/.test(r.prompt));
  assert(!/1\. \[(?:suggested|unverified)\][^\n]*\n[^\n]*Load this first/.test(r.prompt));
});

console.log('');
