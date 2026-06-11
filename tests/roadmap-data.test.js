const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const roadmap = fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8');
const agenticCsv = fs.readFileSync(path.join(root, 'data/patterns/agentic-next.csv'), 'utf8');
const pkg = require('../package.json');

for (const expected of [
  'Prompt Builder Roadmap',
  'Verification-First Contract',
  'Context Diet Score',
  'Tool/MCP Readiness Audit',
  'Hackathon Mode',
  'Skill Bloat Detector',
]) {
  assert(roadmap.includes(expected), `ROADMAP.md missing ${expected}`);
}

for (const expected of [
  'VerificationFirst',
  'SubagentIsolation',
  'ToolSearchFirst',
  'ComposableWorkflows',
  'HackathonDomainFirst',
  'AgentPortfolio',
]) {
  assert(agenticCsv.includes(expected), `agentic-next.csv missing ${expected}`);
}

assert(pkg.files.includes('ROADMAP.md'), 'package.json files should include ROADMAP.md');

console.log('roadmap-data tests passed');
