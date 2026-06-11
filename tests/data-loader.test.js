const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseCsv, loadCsv, DataValidationError } = require('../src/data-loader');
const { generatePrompt } = require('../src');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (error) { console.log(`  ❌ ${name}`); console.log(`     ${error.message}`); process.exitCode = 1; }
}

console.log('\nData Loader Tests');

test('RFC CSV parsing handles commas, escaped quotes, CRLF, and no final newline', () => {
  const rows = parseCsv('a,b\r\n"x,y","say ""hi"""');
  assert.deepStrictEqual(rows.map(row => row.values), [['a', 'b'], ['x,y', 'say "hi"']]);
});

test('loadCsv validates required headers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-data-'));
  const file = path.join(dir, 'x.csv');
  fs.writeFileSync(file, 'a,b\n1,2\n');
  assert.throws(() => loadCsv(file, { header: true, requiredColumns: ['missing'] }), DataValidationError);
});

test('custom dataDir changes generated template output', () => {
  const root = path.join(__dirname, '..', 'data');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-data-dir-'));
  fs.cpSync(root, dir, { recursive: true });
  const feature = path.join(dir, 'templates', 'feature.csv');
  fs.appendFileSync(feature, '\nConstraints,Fixture contract loaded from custom dataDir\n');
  const result = generatePrompt('add a timer', { dataDir: dir, stackProfile: false });
  assert(result.prompt.includes('Fixture contract loaded from custom dataDir'));
});

test('context report no longer reads qualityRubric before initialization', () => {
  const result = generatePrompt('review this project', {
    cwd: process.cwd(),
    stackProfile: false,
    contextReport: true,
  });
  assert(result.prompt.includes('Quality rubric (dev-metrics):'));
});

console.log('');
