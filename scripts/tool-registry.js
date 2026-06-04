#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BUILT_IN_TOOLS = [
  { name: 'read', description: 'Read file contents', inputSchema: { file_path: 'string' }, preHooks: ['scope-gate'], postHooks: [] },
  { name: 'write', description: 'Write or overwrite file', inputSchema: { file_path: 'string', content: 'string' }, preHooks: ['scope-gate', 'destructive-review'], postHooks: ['audit-log'] },
  { name: 'edit', description: 'Targeted string replacement', inputSchema: { file_path: 'string', old_string: 'string', new_string: 'string' }, preHooks: ['scope-gate', 'destructive-review'], postHooks: ['audit-log'] },
  { name: 'glob', description: 'Search for file paths', inputSchema: { pattern: 'string', path: 'string?' }, preHooks: [], postHooks: [] },
  { name: 'grep', description: 'Search for patterns in files', inputSchema: { pattern: 'string', path: 'string?' }, preHooks: [], postHooks: [] },
  { name: 'shell', description: 'Execute shell command', inputSchema: { command: 'string', timeout: 'number?' }, preHooks: ['command-allowlist'], postHooks: [] },
  { name: 'Agent', description: 'Spawn a subagent', inputSchema: { description: 'string', prompt: 'string', subagent_type: 'string' }, preHooks: ['iteration-limit'], postHooks: ['state-update'] }
];

function loadSkillTools(dataDir = path.join(__dirname, '..', 'data')) {
  const agentsFile = path.join(dataDir, 'agents.csv');
  if (!fs.existsSync(agentsFile)) return [];
  
  const content = fs.readFileSync(agentsFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const parts = line.split(',');
    return {
      name: parts[0],
      description: `${parts[0]} specialist agent`,
      skill: parts[1],
      agentType: parts[2],
      triggers: parts[3],
      outputFormat: parts[4],
      preHooks: ['scope-gate'],
      postHooks: ['normalize-output']
    };
  });
}

function getToolRegistry() {
  return {
    builtIn: BUILT_IN_TOOLS,
    skills: loadSkillTools(),
    all: [...BUILT_IN_TOOLS, ...loadSkillTools()]
  };
}

function findTool(name) {
  const registry = getToolRegistry();
  return registry.all.find(t => t.name === name);
}

function listTools() {
  const registry = getToolRegistry();
  console.log('Built-in Tools:');
  registry.builtIn.forEach(t => console.log(`  • ${t.name}: ${t.description}`));
  console.log('\nSkill-based Agents:');
  registry.skills.forEach(t => console.log(`  • ${t.name} (${t.skill}): ${t.description}`));
}

if (require.main === module) {
  listTools();
}

module.exports = { getToolRegistry, findTool, listTools, BUILT_IN_TOOLS };
