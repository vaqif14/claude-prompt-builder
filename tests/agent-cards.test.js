const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadAgentCards } = require('../src/agent-cards');
const { generatePrompt } = require('../src');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (error) { console.log(`  ❌ ${name}`); console.log(`     ${error.message}`); process.exitCode = 1; }
}

console.log('\nAgent Card Tests');

test('all cards include mandatory scope fences and evidence', () => {
  const cards = loadAgentCards();
  assert(cards.length > 10);
  for (const card of cards) {
    assert(card.out_of_scope, card.id);
    assert(card.required_evidence, card.id);
  }
});

test('live council renders compact structured cards', () => {
  const result = generatePrompt('review admin dashboard', { stackProfile: false });
  assert(result.prompt.includes('Out of scope:'));
  assert(result.prompt.includes('Evidence:'));
  assert.strictEqual(result.metadata.agents, (result.prompt.match(/^\s+\d+\. Role:/gm) || []).length);
});

test('missing out_of_scope fails schema validation', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-agent-data-'));
  fs.cpSync(path.join(__dirname, '..', 'data'), dataDir, { recursive: true });
  const file = path.join(dataDir, 'agents.csv');
  const text = fs.readFileSync(file, 'utf8').replace('Not a code architecture owner', '');
  fs.writeFileSync(file, text);
  assert.throws(() => loadAgentCards(dataDir), /out_of_scope/);
});

console.log('');
