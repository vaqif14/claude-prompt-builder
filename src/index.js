const fs = require('fs');
const path = require('path');
const { searchData } = require('../scripts/search');
const { validatePrompt } = require('../scripts/validate');
const { buildSkill } = require('../scripts/build');

function generatePrompt(task, options = {}) {
  const { template = 'feature', stack = 'nextjs' } = options;
  
  const dataDir = path.join(__dirname, '..', 'data');
  
  // Load template
  const templateFile = path.join(dataDir, 'templates', `${template}.csv`);
  const templateRows = fs.existsSync(templateFile) 
    ? fs.readFileSync(templateFile, 'utf-8').split('\n').filter(l => l.trim()).slice(1)
    : [];
  
  // Load stack
  const stackFile = path.join(dataDir, 'stacks', `${stack}.csv`);
  const stackRows = fs.existsSync(stackFile)
    ? fs.readFileSync(stackFile, 'utf-8').split('\n').filter(l => l.trim()).slice(1)
    : [];
  
  // Parse template sections
  const sections = {};
  for (const row of templateRows) {
    const parts = row.split(',');
    const section = parts[0];
    const key = parts[1] || '';
    const value = parts.slice(2).join(',') || key;
    if (!sections[section]) sections[section] = [];
    sections[section].push({ key, value });
  }
  
  // Parse stack context
  const stackContext = {};
  for (const row of stackRows) {
    const parts = row.split(',');
    const category = parts[0];
    const key = parts[1] || '';
    const value = parts.slice(2).join(',') || key;
    if (!stackContext[category]) stackContext[category] = [];
    stackContext[category].push({ key, value });
  }
  
  // Build prompt
  const lines = [
    `Role: ${sections.Role?.[0]?.value || 'Senior engineer'}`,
    `Mission: ${task}`,
    '',
    'User Profile:',
    '  - Execution-first iterative delivery',
    '  - Strict type safety',
    '  - Tests required for all public APIs',
    '  - Changelog updates mandatory',
    '',
    'Codebase Profile:',
  ];
  
  for (const [cat, items] of Object.entries(stackContext)) {
    for (const item of items) {
      const display = item.value && item.value !== item.key 
        ? `${item.key}: ${item.value}` 
        : item.key;
      lines.push(`  - ${display}`);
    }
  }
  
  lines.push('');
  lines.push('Sub-tasks:');
  for (const item of sections.SubTasks || []) {
    lines.push(`  - [ ] ${item.value}`);
  }
  
  lines.push('');
  lines.push('Constraints:');
  for (const item of sections.Constraints || []) {
    lines.push(`  - ${item.value}`);
  }
  
  lines.push('');
  lines.push('Tool Permissions:');
  for (const item of sections.ToolPermissions || []) {
    lines.push(`  - ${item.value}`);
  }
  
  lines.push('');
  lines.push('Acceptance Criteria:');
  for (const item of sections.AcceptanceCriteria || []) {
    lines.push(`  - [ ] ${item.value}`);
  }
  
  const promptText = lines.join('\n');
  const validation = validatePrompt(promptText);
  
  return {
    prompt: promptText,
    validation,
    metadata: {
      template,
      stack,
      task,
      complexity: task.length > 50 ? 'Medium' : 'Low',
      contextSize: promptText.length < 2000 ? 'Small' : promptText.length < 4000 ? 'Medium' : 'Large',
    }
  };
}

module.exports = { generatePrompt, searchData, validatePrompt, buildSkill };
