#!/usr/bin/env node
const path = require('path');
const { loadJson } = require('../src/data-loader');
const { generatePrompt } = require('../src');

function runEval(options = {}) {
  const scenariosFile = options.scenariosFile || path.join(__dirname, '..', 'data', 'evals', 'scenarios.json');
  const scenarios = loadJson(scenariosFile);
  const results = scenarios.map(scenario => {
    try {
      const result = generatePrompt(scenario.task, {
        mode: scenario.mode,
        stackProfile: false,
        maxTokens: 6000,
      });
      const missing = scenario.expect.filter(expected => !result.prompt.includes(expected));
      return {
        id: scenario.id,
        pass: missing.length === 0 && result.validation.score >= 80,
        score: result.validation.score,
        tokens: Math.ceil(result.prompt.length / 4),
        missing,
      };
    } catch (error) {
      return { id: scenario.id, pass: false, error: error.message, missing: scenario.expect };
    }
  });
  return {
    total: results.length,
    passed: results.filter(result => result.pass).length,
    failed: results.filter(result => !result.pass).length,
    results,
  };
}

if (require.main === module) {
  const report = runEval();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failed ? 1 : 0);
}

module.exports = { runEval };
