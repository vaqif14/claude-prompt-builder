/**
 * Prompt Assembler
 * Assembles the final professional prompt from all components.
 */
const fs = require('fs');
const path = require('path');
const { validatePrompt } = require('../scripts/validate');
const { getModeConfig } = require('./mode-router');

function parseRows(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8')
    .split('\n')
    .filter(line => line.trim());

  // Smart header detection: skip if first line looks like a header
  if (lines.length > 0 && /^(section|group|domain|key),/i.test(lines[0])) {
    lines.shift();
  }

  return lines.map((line) => {
    const parts = line.split(',');
    const group = (parts[0] || '').trim();
    const key = (parts[1] || '').trim();
    const explicitValue = parts.slice(2).join(',').trim();
    const value = explicitValue || key;
    return { group, key, value };
  });
}

function inferTaskUnderstanding(task, mode, platforms = []) {
  const config = getModeConfig(mode);
  const lower = task.toLowerCase();
  const action = config.label.toLowerCase();
  const surface = /admin|dashboard/.test(lower)
    ? 'admin dashboard'
    : /bidder|auction|auctions|lot|product/.test(lower)
      ? 'bidder auction/product surface'
      : /login|auth/.test(lower)
        ? 'authentication surface'
        : 'requested code surface';
  const expected = /design|ui|ux|dashboard|page|screen|visual/.test(lower)
    ? 'professional UI/UX judgment, visual hierarchy, interaction quality, and runtime evidence'
    : 'source-grounded engineering judgment and runtime evidence';

  return [
    `Intent: ${action} the ${surface}.`,
    `Detected platforms: ${platforms.map(p => p.label).join(', ')}.`,
    `Quality bar: ${expected}.`,
    'Important: the prompt-builder does not perform the work itself; it produces an orchestration prompt that tells the next agent which skills to invoke and what evidence to collect.',
  ];
}

function generatePrompt(task, options = {}) {
  const { inferMode, inferTemplate } = require('./mode-router');
  const { detectPlatformsMixed, detectStack } = require('./platform-detector');
  const {
    analyzeTask,
    getSkillInvocationPlan,
    getSkillDiscoveryProtocol,
    getAgentCouncil,
    getUniversalAgentRoster,
    getMulticaStyleTaskBoard,
    getDesignerRubric,
  } = require('./skill-matcher');

  const mode = inferMode(task, options.mode);
  const template = options.template || mode;
  const stack = detectStack(task);
  const platforms = detectPlatformsMixed(task);
  const analysis = analyzeTask(task);
  const modeConfig = getModeConfig(mode);

  const dataDir = path.join(__dirname, '..', 'data');

  // Load template CSV for supplemental data
  const templateFile = path.join(dataDir, 'templates', `${template}.csv`);
  const templateRows = parseRows(templateFile);
  const sections = {};
  for (const row of templateRows) {
    if (!sections[row.group]) sections[row.group] = [];
    sections[row.group].push(row.value);
  }

  // Load stack CSV
  const stackFile = path.join(dataDir, 'stacks', `${stack}.csv`);
  const stackRows = parseRows(stackFile);
  const stackItems = stackRows
    .filter(row => row.key && row.value)
    .map(row => row.key === row.value ? row.value : `${row.key}: ${row.value}`);

  // Admin dashboard route hints (project-aware)
  const lower = task.toLowerCase();
  const routeHints = /admin|dashboard/.test(lower)
    ? [
        'Admin dashboard route: frontend/src/app/[locale]/(admin)/admin/page.tsx',
        'Dashboard components: frontend/src/features/admin/components/dashboard/',
        'Dashboard hooks: frontend/src/features/admin/hooks/useAdminDashboard.ts and useAdminAnalytics.ts',
        'Admin API client: frontend/src/features/admin/services/admin-client.ts',
        'Translations: frontend/messages/az.json, frontend/messages/en.json, frontend/messages/ru.json',
        'Style contract: docs/reference/frontend-ui-style-contract.md',
      ]
    : [];

  const taskUnderstanding = inferTaskUnderstanding(task, mode, platforms);
  const skillDiscoveryProtocol = getSkillDiscoveryProtocol(task, analysis.domains, platforms);
  const skillPlan = getSkillInvocationPlan(task, template, analysis.domains, platforms);
  const agentCouncil = getAgentCouncil(task, mode);
  const designerRubric = getDesignerRubric(task);
  const universalAgentRoster = getUniversalAgentRoster(task, mode, platforms);
  const taskBoard = getMulticaStyleTaskBoard(task, mode, platforms);

  const isReadOnly = ['audit', 'design-review', 'architecture-review', 'security-review', 'performance-review', 'release-check'].includes(mode);

  // Build prompt
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    '  SYSTEM CONTRACT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Role: ${(sections.Role?.[0] || modeConfig.label).replace(/\[stack\]/g, stack)}`,
    `Mission: ${task}`,
    `Authority: ${modeConfig.authority}`,
    '',
    'Task Understanding:',
    ...taskUnderstanding.map(item => `  • ${item}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  CONTEXT WINDOW',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Stack:',
    ...stackItems.map(i => `  • ${i}`),
    '',
    'Detected Platform Profile:',
    ...platforms.map(p => `  • ${p.label}: signals=${p.signals}; default skills=${p.defaultSkills.join(', ')}; evidence=${p.evidence}`),
    '',
    ...(routeHints.length ? ['Target Surface:', ...routeHints.map(i => `  • ${i}`), ''] : []),
    'User Profile:',
    '  • Execution-first iterative delivery',
    '  • Strict type safety (TypeScript strict mode / Java strong types)',
    '  • Tests required for all public APIs and UI interactions',
    '  • Changelog updates mandatory per package',
    '  • Minimal changes — never over-engineer',
    '',
    '═══════════════════════════════════════════════════════════════',
    '  SKILL DISCOVERY PREFLIGHT',
    '═══════════════════════════════════════════════════════════════',
    '',
    ...skillDiscoveryProtocol.map(item => `  • ${item}`),
    '',
    'Install/Load Recommendation Format:',
    '  • Recommended skill: <skill-name or package>',
    '  • Why: <direct fit to this task>',
    '  • Install/load: <npx skills add ...> or <load existing skill path>',
    '  • Rerun prompt: <exact prompt command after /reload-skills>',
    '',
    '═══════════════════════════════════════════════════════════════',
    '  MATCHED SKILLS',
    '═══════════════════════════════════════════════════════════════',
    '',
    ...analysis.domains.map(d => `  • ${d.skill} (${d.domain}) — ${d.priority} priority`),
    '',
    'Required Skills To Invoke:',
    ...skillPlan.map((item, index) => `  ${index + 1}. ${item.skill} — ${item.reason}`),
    '',
    'Skill Execution Order:',
    ...skillPlan.map((item, index) => `  ${index + 1}. Invoke ${item.skill}: ${item.instruction}`),
    '',
    'Rule: Do not continue with the audit/build until the relevant skills above have been invoked or explicitly marked unavailable with a reason.',
    'Rule: Do not claim a skill was used unless its guidance was actually loaded/read or its workflow was followed.',
    '',
    '═══════════════════════════════════════════════════════════════',
    '  MULTICA-STYLE TASK BOARD',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Use this as a managed-agent task board: split the work into owned task cards, run independent cards in parallel when possible, track status, collect artifacts, then synthesize.',
    'Task Card Schema: id | owner | title | status(todo/in_progress/blocked/done) | depends_on | artifact',
    ...taskBoard.map(card => `  • ${card.id} | ${card.owner} | ${card.title} | ${card.status} | depends_on=${card.dependsOn} | artifact=${card.artifact}`),
    '',
    'Parallelization Rule: run cards with the same dependency in parallel only if they touch different files/surfaces or are read-only review passes.',
    'Conflict Rule: if two agents need to edit the same file, Coordinator must serialize the work and assign one owner.',
    'Handoff Rule: every agent must return findings, touched files, evidence, blockers, and recommended next task.',
    '',
    'Universal Agent Roster:',
    ...universalAgentRoster.map(agent => `  • ${agent.role}: owns=${agent.owns}; when=${agent.when}; deliverable=${agent.deliverable}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  AGENT REVIEW COUNCIL',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Run these review passes. If subagents are available, spawn them. If not, perform them sequentially and keep findings separated:',
    ...agentCouncil.map((agent, index) => `  ${index + 1}. ${agent.name} — ${agent.mission} Output: ${agent.output}`),
    ...(designerRubric.length ? [
      '',
      'Designer-Eye Rubric:',
      ...designerRubric.map(item => `  • ${item}`),
      '',
      'Design verdict rule: If the page merely works but feels visually weak, crowded, generic, or unfinished, the verdict must be "Working with design issues", not "Working".',
    ] : []),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  EXECUTION PLAN',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Sub-tasks:',
    ...(sections.SubTasks || modeConfig.subTasks).map(t => `  - [ ] ${t}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  TOOL DIRECTIVES',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Tool Permissions:',
    ...(sections.ToolPermissions || modeConfig.toolPermissions).map(t => `  • ${t}`),
    '',
    '═══════════════════════════════════════════════════════════════',
    '  CONSTRAINTS',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Constraints:',
    ...(sections.Constraints || [
      'Never modify files outside the working directory',
      'Never commit, push, or rebase unless explicitly asked',
      'Never install global packages without confirmation',
      'Stop and Ask before: destructive ops, architectural changes, security modifications',
    ]).map(c => `  • ${c}`),
    '',
    'Stop Conditions:',
    '  • Escalate to human if destructive operation required',
    '  • Escalate if skill discovery finds a stronger skill but install is blocked',
    '  • Stop if verification gates fail and user has not approved fixes',
    '  • Stop if platform evidence cannot be collected due to missing dev server / emulator / credentials',
    '',
    '═══════════════════════════════════════════════════════════════',
    '  ACCEPTANCE CRITERIA',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Acceptance Criteria:',
    ...(sections.AcceptanceCriteria || modeConfig.acceptanceCriteria).map(a => `  - [ ] ${a}`),
    '',
    'Evidence Gates:',
    '  • Every claim must be backed by file:line, screenshot, command output, or log',
    '  • "Working" verdict requires all gates to pass; partial pass = "Working with issues"',
    '  • Blocked = missing prerequisites documented precisely',
    '',
    '═══════════════════════════════════════════════════════════════',
    '  OUTPUT SCHEMA',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Output Format:',
    ...modeConfig.outputSchema.map(item => `  • ${item}`),
    '',
    '═══════════════════════════════════════════════════════════════',
  ];

  const promptText = lines.join('\n');
  const validation = validatePrompt(promptText);

  return {
    prompt: promptText,
    validation,
    metadata: {
      mode,
      template,
      stack,
      task,
      complexity: analysis.complexity,
      contextSize: promptText.length < 2000 ? 'Small' : promptText.length < 5000 ? 'Medium' : 'Large',
      platforms: platforms.map(p => p.id),
      domains: analysis.domains.map(d => d.domain),
      agents: analysis.agentCount,
      readOnly: isReadOnly,
    },
  };
}

module.exports = { generatePrompt, parseRows, inferTaskUnderstanding };
