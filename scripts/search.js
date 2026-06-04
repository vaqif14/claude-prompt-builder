#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function searchData(query, dataDir = path.join(__dirname, '..', 'data')) {
  const results = [];
  const files = [];
  
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.csv')) files.push(full);
    }
  }
  walk(dataDir);
  
  const q = query.toLowerCase();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        results.push({ file: path.relative(dataDir, file), line: lines[i] });
      }
    }
  }
  return results;
}

if (require.main === module) {
  const query = process.argv.slice(2).join(' ') || 'feature';
  const results = searchData(query);
  console.log(`Found ${results.length} matches for "${query}":\n`);
  for (const r of results) {
    console.log(`  [${r.file}] ${r.line}`);
  }
}

module.exports = { searchData };
