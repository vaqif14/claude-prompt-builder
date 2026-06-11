#!/usr/bin/env node
const path = require('path');
const { loadCsv, loadJson, loadMarkdown, listFiles, validateRows } = require('../src/data-loader');
const { REQUIRED: AGENT_FIELDS } = require('../src/agent-cards');

function validateData(dataDir = path.join(__dirname, '..', 'data')) {
  const errors = [];
  const files = listFiles(dataDir, ['.csv', '.json', '.md']);
  for (const file of files) {
    try {
      if (path.extname(file) === '.md') loadMarkdown(file);
      else if (path.extname(file) === '.json') {
        const value = loadJson(file);
        if (path.basename(file) === 'telemetry.json') {
          if (!Number.isFinite(value.regeneration_window_minutes) || value.regeneration_window_minutes <= 0) {
            throw new Error(`${file}: regeneration_window_minutes must be positive`);
          }
          if (!Number.isInteger(value.minimum_correlation_samples) || value.minimum_correlation_samples < 1) {
            throw new Error(`${file}: minimum_correlation_samples must be a positive integer`);
          }
        }
      }
      else if (path.basename(file) === 'agents.csv') {
        const rows = loadCsv(file, { header: true, requiredColumns: AGENT_FIELDS });
        validateRows(rows, { required: AGENT_FIELDS, unique: 'id' }, file);
      } else if (path.basename(file) === 'skill-trust-patterns.csv') {
        const required = ['id', 'category', 'severity', 'matcher_kind', 'needle', 'label'];
        const rows = loadCsv(file, { header: true, requiredColumns: required, allowSecurityPatterns: true });
        validateRows(rows, {
          required,
          unique: 'id',
          enums: { severity: ['low', 'medium', 'high'], matcher_kind: ['fixed', 'sequence'] },
        }, file);
      } else if (path.basename(file) === 'skill-review-rubric.csv') {
        const required = ['axis', 'check', 'zero_if'];
        const rows = loadCsv(file, { header: true, requiredColumns: required });
        validateRows(rows, { required, unique: 'axis' }, file);
      } else if (path.basename(file) === 'output-leads.csv') {
        const required = ['kind', 'text'];
        const rows = loadCsv(file, { header: true, requiredColumns: required });
        validateRows(rows, {
          required,
          unique: 'kind',
          enums: { kind: ['write', 'read-only'] },
        }, file);
      } else loadCsv(file, { header: false, allowTemplates: true });
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { files: files.length, errors };
}

if (require.main === module) {
  const result = validateData(process.argv[2]);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    process.exit(1);
  }
  console.log(`Validated ${result.files} data files.`);
}

module.exports = { validateData };
