#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function loadCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const parts = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (parts[i] || '').trim());
    return obj;
  });
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
