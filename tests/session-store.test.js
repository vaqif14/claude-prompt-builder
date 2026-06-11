const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSessionStore } = require('../src/session-store');
const { buildStats, buildFeedbackReport } = require('../src/session-analytics');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (error) { console.log(`  ❌ ${name}`); console.log(`     ${error.stack || error.message}`); process.exitCode = 1; }
}

function tempStore(options = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-store-'));
  return {
    baseDir,
    store: createSessionStore({ baseDir, random: () => 'fixed1', ...options }),
  };
}

console.log('\nSession Store Tests');

test('JSONL append and index remain consistent with private permissions', () => {
  const { baseDir, store } = tempStore({ now: () => Date.parse('2026-06-11T10:00:00Z') });
  const id = store.createSession('task', 'feature', 'nextjs', 'sess_test');
  store.saveTurn(id, 'task', 'output', 95, { estimatedTokens: 123, template: 'feature' });
  const file = path.join(baseDir, 'sessions', `${id}.jsonl`);
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepStrictEqual(lines.map(event => event.type), ['session_created', 'generation']);
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  assert.strictEqual(fs.statSync(path.join(baseDir, 'index.json')).mode & 0o777, 0o600);
  assert.strictEqual(store.listSessions()[0].id, id);
});

test('outcome recording round-trips and stats math is correct', () => {
  let time = Date.parse('2026-06-11T10:00:00Z');
  const { store } = tempStore({ now: () => (time += 60_000) });
  const id = store.createSession('task', 'feature', 'nextjs', 'sess_stats');
  store.saveTurn(id, 'task', 'one', 80, { estimatedTokens: 100, mode: 'feature' });
  store.saveTurn(id, 'task', 'two', 100, { estimatedTokens: 200, mode: 'feature' });
  store.recordOutcome(id, 'fail', 'fixture');
  const stats = buildStats(store);
  assert.strictEqual(stats.averageValidationScore, 90);
  assert.strictEqual(stats.averageEstimatedPromptTokens, 150);
  assert.strictEqual(stats.outcomes.fail, 1);
  assert.strictEqual(store.getSession(id).outcome, 'fail');
});

test('legacy migration is idempotent and preserves the legacy file', () => {
  const { baseDir, store } = tempStore({ now: () => Date.parse('2026-06-11T10:00:00Z') });
  const legacy = {
    sessions: [{ id: 'sess_legacy', task: 'old', mode: 'audit', stack: 'general', created_at: '2026-06-01T00:00:00Z' }],
    turns: [{ id: 1, session_id: 'sess_legacy', prompt: 'old', output: 'prompt', validation_score: 88, timestamp: '2026-06-01T00:01:00Z' }],
    artifacts: [],
  };
  fs.writeFileSync(path.join(baseDir, 'sessions.json'), JSON.stringify(legacy));
  assert.strictEqual(store.migrateLegacy(), true);
  assert.strictEqual(store.migrateLegacy(), false);
  assert(fs.existsSync(path.join(baseDir, 'sessions.json')));
  assert.strictEqual(store.getSession('sess_legacy').turns.length, 1);
});

test('corrupt JSONL tail does not erase earlier events', () => {
  const { baseDir, store } = tempStore();
  store.createSession('task', 'feature', 'general', 'sess_corrupt');
  fs.appendFileSync(path.join(baseDir, 'sessions', 'sess_corrupt.jsonl'), '{"torn":');
  assert(store.getSession('sess_corrupt'));
});

test('session ids reject path traversal', () => {
  const { store } = tempStore();
  assert.throws(() => store.createSession('x', 'feature', 'general', '../escape'), /Invalid session id/);
});

test('feedback report detects quick regeneration and ranks affected sections', () => {
  let time = Date.parse('2026-06-11T10:00:00Z');
  const { store } = tempStore({ now: () => (time += 5 * 60_000) });
  const id = store.createSession('task', 'feature', 'nextjs', 'sess_feedback', { template: 'feature' });
  const metadata = { mode: 'feature', stack: 'nextjs', template: 'feature', sections: ['TASK PLAN'] };
  store.saveTurn(id, 'task', 'one', 70, metadata);
  store.saveTurn(id, 'task', 'two', 75, metadata);
  store.recordOutcome(id, 'fail');
  const report = buildFeedbackReport(store);
  assert.strictEqual(report.regenerations.length, 1);
  assert(report.sectionsToRevisit.some(item => item.section === 'TASK PLAN'));
  assert(/Correlation is not causation/.test(report.note));
});

console.log('');
