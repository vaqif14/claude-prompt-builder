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

console.log('\nSolution Flow (Feature B) Tests');

// ── B1 ──────────────────────────────────────────────────────────────────────────────────────
test('B1: low-confidence ambiguous task → CLARIFY-FIRST GATE with A/B options naming real paths', () => {
  const cwd = ambiguousRepo();
  const r = generatePrompt('redesign this', { cwd });
  assert(/CLARIFY-FIRST GATE/.test(r.prompt), 'gate should be present for ambiguous task');
  assert(r.metadata.clarify, 'metadata.clarify set');
  assert(/\n {4}A\) /.test(r.prompt) && /\n {4}B\) /.test(r.prompt), 'A/B options rendered');
  assert(/adminpanel\.tsx|reportsboard\.tsx/.test(r.prompt), 'options name real repo paths');
  assert(r.prompt.indexOf('CLARIFY-FIRST GATE') < r.prompt.indexOf('PROBLEM ANALYSIS'), 'clarify precedes diagnosis');
});

test('B1: high-confidence task (names a real file) → NO clarify gate', () => {
  const cwd = ambiguousRepo();
  const r = generatePrompt('redesign the reportsboard component', { cwd });
  assert(!/CLARIFY-FIRST GATE/.test(r.prompt), 'no gate when the target is clear');
  assert.strictEqual(r.metadata.clarify, null);
});

// ── B2 ──────────────────────────────────────────────────────────────────────────────────────
test('B2: validatePrompt returns blockingMarkers with line numbers + sections', () => {
  const r = generatePrompt('refactor the payment service', {});
  const v = r.validation;
  assert(Array.isArray(v.blockingMarkers) && v.blockingMarkers.length > 0, 'unfilled prompt has blocking markers');
  assert(v.blockingMarkers.every(m => typeof m.line === 'number' && m.section && m.marker), 'each marker has line/section/marker');
  assert(v.blockingMarkers.some(m => /PROBLEM ANALYSIS/.test(m.section)), 'diagnosis markers reported');
});

test('B2: filling all RESOLVE markers clears blockingMarkers', () => {
  const r = generatePrompt('refactor the payment service', {});
  const filled = r.prompt.replace(/<RESOLVE[^>]*>/g, 'src/PaymentService.java:142 — extract retry() helper');
  const v = validatePrompt(filled);
  assert.strictEqual(v.blockingMarkers.length, 0, 'no markers after filling');
});

test('B2: --save refuses a draft (exit 1, lists markers); --save-draft writes', () => {
  const cwd = ambiguousRepo();
  const bin = path.join(__dirname, '..', 'bin', 'prompt-builder.js');
  const out = path.join(cwd, 'p.txt');
  let blocked = false;
  try {
    execFileSync('node', [bin, '--no-discover', '--no-stack-cache', '--save', out, 'add a timer'], { cwd, stdio: 'pipe' });
  } catch (e) {
    blocked = true;
    assert(/DRAFT/.test(String(e.stderr || '')), 'error explains DRAFT');
  }
  assert(blocked, '--save must exit non-zero on a draft');
  assert(!fs.existsSync(out), 'draft file not written by --save');
  execFileSync('node', [bin, '--no-discover', '--no-stack-cache', '--save-draft', out, 'add a timer'], { cwd, stdio: 'pipe' });
  assert(fs.existsSync(out), '--save-draft writes the file');
});

test('B2: OUTPUT SCHEMA requires leading with the solution table (write) / findings ledger (read-only)', () => {
  const write = generatePrompt('add a timer', {}).prompt;
  assert(/SOLUTION TABLE — one row per edit: `file:line → current → change → why`/.test(write), 'write mode leads with solution table');
  const audit = generatePrompt('review the dashboard and confirm all working', {}).prompt;
  assert(/FINDINGS LEDGER table/.test(audit), 'read-only leads with findings ledger');
});

// ── B3 ──────────────────────────────────────────────────────────────────────────────────────
test('B3: invocation gate order stated; not-installed never load-first', () => {
  const cwd = ambiguousRepo();
  const discovery = {
    status: 'ok', reason: null, fromCache: false,
    installed: [], available: [{ name: 'ui-ux-pro-max', description: 'visual review', query: 'ui ux design review', relevance: 0.9, status: 'available' }],
    unavailable: [],
  };
  const r = generatePrompt('redesign this', { cwd, discovery });
  assert(/GATE ORDER:/.test(r.prompt), 'gate order directive present');
  assert(!/1\. \[(?:suggested|unverified)\][^\n]*\n[^\n]*Load this first/.test(r.prompt), 'no not-installed load-first');
});

console.log('');
