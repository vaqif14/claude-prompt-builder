const assert = require('assert');
const { runEval } = require('../scripts/eval');

console.log('\nEval Harness Tests');
const report = runEval();
assert.strictEqual(report.total, 20, 'expected 20 scenarios');
if (report.failed) console.log(JSON.stringify(report.results.filter(result => !result.pass), null, 2));
assert.strictEqual(report.failed, 0, `${report.failed} scenarios failed`);
console.log(`  ✅ ${report.passed}/${report.total} scenarios passed\n`);
