#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { loadCsv: loadCsvData } = require('../src/data-loader');

function loadCsv(filePath) {
  return loadCsvData(filePath, { header: true });
}

function buildSkill(dataDir = path.join(__dirname, '..', 'data')) {
  const sections = [];
  
  // Load all templates
  const templateDir = path.join(dataDir, 'templates');
  for (const file of fs.readdirSync(templateDir)) {
    const rows = loadCsv(path.join(templateDir, file));
    const name = file.replace('.csv', '');
    sections.push({ type: 'template', name, rows });
  }
  
  // Load all stacks
  const stackDir = path.join(dataDir, 'stacks');
  for (const file of fs.readdirSync(stackDir)) {
    const rows = loadCsv(path.join(stackDir, file));
    const name = file.replace('.csv', '');
    sections.push({ type: 'stack', name, rows });
  }
  
  return sections;
}

if (require.main === module) {
  const sections = buildSkill();
  console.log(`Built skill with ${sections.length} sections:`);
  for (const s of sections) {
    console.log(`  ${s.type}: ${s.name} (${s.rows.length} rows)`);
  }
}

module.exports = { loadCsv, buildSkill };
