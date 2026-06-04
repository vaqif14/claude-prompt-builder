const fs = require('fs');
const path = require('path');
const { searchData } = require('../scripts/search');
const { validatePrompt } = require('../scripts/validate');
const { matchAgents } = require('../scripts/orchestrate');

function analyzeTask(task) {
  const lower = task.toLowerCase();
  const domains = [];
  
  if (/design|ui|ux|style|css|layout|theme|color|font|responsive/.test(lower)) {
    domains.push({ domain: 'ui-ux', skill: 'ui-ux-pro-max', priority: 'high' });
  }
  if (/react|next|component|page|tsx|jsx|frontend|hook|context/.test(lower)) {
    domains.push({ domain: 'frontend-code', skill: 'frontend-patterns', priority: 'high' });
  }
  if (/java|spring|boot|backend|api|controller|service|repository/.test(lower)) {
    domains.push({ domain: 'backend-code', skill: 'springboot-patterns', priority: 'high' });
  }
  if (/test|spec|jest|junit|mock|coverage/.test(lower)) {
    domains.push({ domain: 'testing', skill: 'springboot-tdd', priority: 'medium' });
  }
  if (/security|auth|jwt|cors|xss|sql|inject/.test(lower)) {
    domains.push({ domain: 'security', skill: 'springboot-security', priority: 'high' });
  }
  if (/database|db|migration|schema|sql|postgres/.test(lower)) {
    domains.push({ domain: 'database', skill: 'database-migrations', priority: 'medium' });
  }
  if (/performance|slow|optimize|cache|memory|cpu/.test(lower)) {
    domains.push({ domain: 'performance', skill: 'frontend-patterns', priority: 'medium' });
  }
  if (/refactor|clean|debt|smell|extract/.test(lower)) {
    domains.push({ domain: 'refactoring', skill: 'java-code-review', priority: 'medium' });
  }
  
  if (domains.length === 0) {
    domains.push({ domain: 'general', skill: 'frontend-patterns', priority: 'medium' });
  }
  
  const complexity = task.length > 100 ? 'High' : task.length > 50 ? 'Medium' : 'Low';
  const agentCount = Math.min(domains.filter(d => d.priority === 'high').length + 1, 4);
  
  return { domains, complexity, agentCount };
}

function detectStack(task) {
  const lower = task.toLowerCase();
  if (/spring|java|gradle|backend/.test(lower)) return 'spring-boot';
  if (/react|next|tsx|frontend|shadcn|mui/.test(lower)) return 'nextjs';
  return 'nextjs';
}

function generatePrompt(task, options = {}) {
  const { template = 'feature' } = options;
  const stack = detectStack(task);
  const analysis = analyzeTask(task);
  
  const dataDir = path.join(__dirname, '..', 'data');
  
  // Load template
  const templateFile = path.join(dataDir, 'templates', `${template}.csv`);
  const templateRows = fs.existsSync(templateFile) 
    ? fs.readFileSync(templateFile, 'utf-8').split('\n').filter(l => l.trim()).slice(1)
    : [];
  
  // Load stack context
  const stackFile = path.join(dataDir, 'stacks', `${stack}.csv`);
  const stackRows = fs.existsSync(stackFile)
    ? fs.readFileSync(stackFile, 'utf-8').split('\n').filter(l => l.trim()).slice(1)
    : [];
  
  // Parse template sections
  const sections = {};
  for (const row of templateRows) {
    const parts = row.split(',');
    const section = parts[0];
    const value = parts.slice(1).join(',');
    if (!sections[section]) sections[section] = [];
    sections[section].push(value);
  }
  
  // Parse stack context
  const stackItems = [];
  for (const row of stackRows) {
    const parts = row.split(',');
    const value = parts.slice(1).join(',');
    if (value) stackItems.push(value);
  }
  
  // Build professional prompt
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  SYSTEM CONTRACT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Role: ${sections.Role?.[0] || 'Senior Full-Stack Engineer'}`,
    `Mission: ${task}`,
    `Authority: Autonomous execution with human escalation for destructive ops`,
    '',
    '═══════════════════════════════════════════════════════════════',
    '  CONTEXT WINDOW',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Stack:',
    ...stackItems.map(i => `  • ${i}`),
    '',
    'User Profile:',
    '  • Execution-first iterative delivery',
    '  • Strict type safety (TypeScript strict mode / Java strong types)',
    '  • Tests required for all public APIs and UI interactions',
    '  • Changelog updates mandatory per package',
    '  • Minimal changes — never over-engineer',
    '',
    '═══════════════════════════════════════════════════════════════',
    '  MATCHED SKILLS',
    '═══════════════════════════════════════════════════════════════',
    '',
    ...analysis.domains.map(d => `  • ${d.skill} (${d.domain}) — ${d.priority} priority`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  EXECUTION PLAN',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Sub-tasks:',
    ...(sections.SubTasks || ['Analyze requirements', 'Implement solution', 'Add tests', 'Update changelog']).map(t => `  - [ ] ${t}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  TOOL DIRECTIVES',
    '═══════════════════════════════════════════════════════════════',
    '',
    ...(sections.ToolPermissions || [
      'read: allowed for all source files',
      'write: allowed within src/ and backend/src/',
      'edit: preferred over write for existing files',
      'shell: allowed for build/test commands only',
      'Agent: allowed for parallel domain analysis'
    ]).map(t => `  • ${t}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  CONSTRAINTS',
    '═══════════════════════════════════════════════════════════════',
    '',
    ...(sections.Constraints || [
      'Never modify files outside the working directory',
      'Never commit, push, or rebase unless explicitly asked',
      'Never install global packages without confirmation',
      'Stop and Ask before: destructive ops, architectural changes, security modifications'
    ]).map(c => `  • ${c}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  ACCEPTANCE CRITERIA',
    '═══════════════════════════════════════════════════════════════',
    '',
    ...(sections.AcceptanceCriteria || [
      'All existing tests pass',
      'New tests cover added logic',
      'Type check passes (tsc / javac)',
      'No console errors or warnings',
      'Changelog updated'
    ]).map(a => `  - [ ] ${a}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  OUTPUT SCHEMA',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Deliver:',
    '  1. Execution plan with active task marked',
    '  2. Concrete file:line changes (never "fix error" — always "change X to Y")',
    '  3. Test additions with test names',
    '  4. Changelog entry',
    '  5. Metadata card: Complexity | Risk | Rollback plan',
    '',
    '═══════════════════════════════════════════════════════════════',
  ];
  
  const promptText = lines.join('\n');
  const validation = validatePrompt(promptText);
  
  return {
    prompt: promptText,
    validation,
    metadata: {
      template,
      stack,
      task,
      complexity: analysis.complexity,
      contextSize: promptText.length < 2000 ? 'Small' : promptText.length < 4000 ? 'Medium' : 'Large',
      domains: analysis.domains.map(d => d.domain),
      agents: analysis.agentCount,
    }
  };
}

module.exports = { generatePrompt, searchData, validatePrompt, analyzeTask, detectStack };
