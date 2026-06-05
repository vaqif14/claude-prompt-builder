/**
 * Prompt Assembler
 * Assembles the final professional prompt from all components.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validatePrompt } = require('../scripts/validate');
const { getModeConfig } = require('./mode-router');
const { ensureStackProfile } = require('./stack-cache');
const { selectModel } = require('./model-router');
const { sanitizeCsvValue } = require('./sanitize');

function parseRows(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8')
    .split('\n')
    .filter(line => line.trim());

  // Smart header detection: skip if first line looks like a header
  if (lines.length > 0 && /^(section|group|domain|category|key),/i.test(lines[0])) {
    lines.shift();
  }

  return lines.map((line) => {
    const parts = line.split(',');
    const group = sanitizeCsvValue((parts[0] || '').trim(), file);
    const key = sanitizeCsvValue((parts[1] || '').trim(), file);
    const explicitValue = sanitizeCsvValue(parts.slice(2).join(',').trim(), file);
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
    getSkillSearchQueries,
    getAgentCouncil,
    getUniversalAgentRoster,
    getMulticaStyleTaskBoard,
    getDesignerRubric,
  } = require('./skill-matcher');

  const mode = inferMode(task, options.mode);
  const template = options.template || mode;
  const detectionTask = options.platform ? `${task} ${options.platform}` : task;
  const stack = options.stack || detectStack(detectionTask);
  const platforms = detectPlatformsMixed(detectionTask);
  const analysis = analyzeTask(detectionTask);
  const modeConfig = getModeConfig(mode);

  const dataDir = path.join(__dirname, '..', 'data');

  verifyDataIntegrity(dataDir);

  // Load template CSV for supplemental data
  const templateFile = path.join(dataDir, 'templates', `${template}.csv`);
  const templateRows = parseRows(templateFile);
  const sections = {};
  for (const row of templateRows) {
    if (!sections[row.group]) sections[row.group] = [];
    sections[row.group].push(row.value);
  }

  // Load stack CSV and split by group
  const stackFile = path.join(dataDir, 'stacks', `${stack}.csv`);
  const stackRows = parseRows(stackFile);

  const stackContext = [];
  const bestPractices = [];
  const antiPatterns = [];
  const verificationGates = [];

  for (const row of stackRows) {
    if (!row.key && !row.value) continue;
    const item = row.key === row.value ? row.value : `${row.key}: ${row.value}`;
    if (row.group === 'BestPractices') bestPractices.push(item);
    else if (row.group === 'AntiPatterns') antiPatterns.push(item);
    else if (row.group === 'Verification') verificationGates.push(item);
    else stackContext.push(item);
  }

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
  const skillPlan = getSkillInvocationPlan(task, template, analysis.domains, platforms, analysis.complexity, options);
  const skillQueries = getSkillSearchQueries(task, analysis.domains, platforms, stack);
  const stackProfile = options.stackProfile
    ? ensureStackProfile({
        cwd: options.cwd || process.cwd(),
        cacheDir: options.cacheDir,
        refresh: Boolean(options.refreshStackProfile),
        stack,
        task,
        platforms,
        stackContext,
        bestPractices,
        antiPatterns,
        verificationGates,
        skillPlan,
        skillQueries,
      })
    : null;
  const skillDiscoveryProtocol = getSkillDiscoveryProtocol(task, analysis.domains, platforms, stack, stackProfile);
  const agentCouncil = getAgentCouncil(task, mode, analysis.complexity, options);
  const designerRubric = getDesignerRubric(task);
  const universalAgentRoster = getUniversalAgentRoster(task, mode, platforms, analysis.complexity, options);
  const taskBoard = getMulticaStyleTaskBoard(task, mode, platforms);

  const isReadOnly = ['audit', 'design-review', 'architecture-review', 'security-review', 'performance-review', 'release-check'].includes(mode);

  // Build prompt sections
  const promptSections = []

  promptSections.push({
    name: 'SYSTEM CONTRACT',
    priority: 0,
    lines: [
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
    ],
  })

  promptSections.push({
    name: 'CONTEXT WINDOW',
    priority: 1,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  CONTEXT WINDOW',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Stack:',
      ...stackContext.map(i => `  • ${i}`),
      '',
      'Detected Platform Profile:',
      ...platforms.map(p => `  • ${p.label}: signals=${p.signals}; default skills=${p.defaultSkills.join(', ')}; evidence=${p.evidence}`),
      '',
      ...(routeHints.length ? ['Target Surface:', ...routeHints.map(i => `  • ${i}`), ''] : []),
      ...(stackProfile ? [
        'Stack Profile Cache:',
        `  • Status: ${stackProfile.status.toUpperCase()}`,
        `  • File: ${stackProfile.relativePath}`,
        '  • Rule: read this MD before asking for skill discovery; skip repeated skill searches when status is HIT.',
        '  • Install rule: missing skills from the MD require explicit user approval before install.',
        '',
      ] : []),
      'User Profile:',
      '  • Execution-first iterative delivery',
      '  • Strict type safety (TypeScript strict mode / Java strong types)',
      '  • Tests required for all public APIs and UI interactions',
      '  • Changelog updates mandatory per package',
      '  • Minimal changes — never over-engineer',
      '',
    ],
  })

  promptSections.push({
    name: 'SKILL DISCOVERY PREFLIGHT',
    priority: 1,
    lines: [
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
    ],
  })

  promptSections.push({
    name: 'MATCHED SKILLS',
    priority: 2,
    lines: [
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
    ],
  })

  promptSections.push({
    name: 'MULTICA-STYLE TASK BOARD',
    priority: 0,
    lines: [
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
    ],
  })

  promptSections.push({
    name: 'AGENT REVIEW COUNCIL',
    priority: 2,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  AGENT REVIEW COUNCIL',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Run these review passes. If subagents are available, spawn them. If not, perform them sequentially and keep findings separated:',
      ...agentCouncil.map((agent, index) => `  ${index + 1}. ${agent.name} — ${agent.mission} Output: ${agent.output}`),
      '',
    ],
  })

  if (designerRubric.length) {
    promptSections.push({
      name: 'DESIGNER RUBRIC',
      priority: 3,
      lines: [
        'Designer-Eye Rubric:',
        ...designerRubric.map(item => `  • ${item}`),
        '',
        'Design verdict rule: If the page merely works but feels visually weak, crowded, generic, or unfinished, the verdict must be "Working with design issues", not "Working".',
        '',
      ],
    })
  }

  promptSections.push({
    name: 'MODEL ASSIGNMENTS',
    priority: 3,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  MODEL ASSIGNMENTS',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Task complexity: ${analysis.complexity} | Default model: ${selectModel(task, analysis.complexity, options)}`,
      ...agentCouncil.map((agent, index) => `  ${index + 1}. ${agent.name} — ${agent.model} (${analysis.complexity} complexity)`),
      ...universalAgentRoster.map((agent, index) => `  ${String.fromCharCode(97 + index)}. ${agent.role} — ${agent.model} (${analysis.complexity} complexity)`),
      `  Override: use --model <model> to force a specific model for all agents.`,
      '',
    ],
  })

  promptSections.push({
    name: 'EXECUTION PLAN',
    priority: 0,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  EXECUTION PLAN',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Sub-tasks:',
      ...(sections.SubTasks || modeConfig.subTasks).map(t => `  - [ ] ${t}`),
      '',
    ],
  })

  promptSections.push({
    name: 'TOOL DIRECTIVES',
    priority: 0,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  TOOL DIRECTIVES',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Tool Permissions:',
      ...(sections.ToolPermissions || modeConfig.toolPermissions).map(t => `  • ${t}`),
      '',
    ],
  })

  promptSections.push({
    name: 'CONSTRAINTS',
    priority: 0,
    lines: [
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
    ],
  })

  promptSections.push({
    name: 'STACK BEST PRACTICES TO APPLY',
    priority: 1,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  STACK BEST PRACTICES TO APPLY',
      '═══════════════════════════════════════════════════════════════',
      '',
      ...(bestPractices.length ? bestPractices.map(p => `  ✅ ${p}`) : ['  • No stack-specific best practices available']),
      '',
    ],
  })

  promptSections.push({
    name: 'STACK ANTI-PATTERNS TO AVOID',
    priority: 1,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  STACK ANTI-PATTERNS TO AVOID',
      '═══════════════════════════════════════════════════════════════',
      '',
      ...(antiPatterns.length ? antiPatterns.map(p => `  ❌ ${p}`) : ['  • No stack-specific anti-patterns available']),
      '',
    ],
  })

  promptSections.push({
    name: 'STACK VERIFICATION GATES',
    priority: 1,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  STACK VERIFICATION GATES',
      '═══════════════════════════════════════════════════════════════',
      '',
      ...(verificationGates.length ? verificationGates.map(v => `  • ${v}`) : ['  • No stack-specific verification gates available']),
      '',
      'Stop Conditions:',
      '  • Escalate to human if destructive operation required',
      '  • Escalate if skill discovery finds a stronger skill but install is blocked',
      '  • Stop if verification gates fail and user has not approved fixes',
      '  • Stop if platform evidence cannot be collected due to missing dev server / emulator / credentials',
      '',
    ],
  })

  promptSections.push({
    name: 'ACCEPTANCE CRITERIA',
    priority: 0,
    lines: [
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
    ],
  })

  promptSections.push({
    name: 'OUTPUT SCHEMA',
    priority: 0,
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  OUTPUT SCHEMA',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Output Format:',
      ...modeConfig.outputSchema.map(item => `  • ${item}`),
      '',
      '═══════════════════════════════════════════════════════════════',
    ],
  })

  // Apply token budgeting
  const {
    estimateTokens,
    assignBudget,
    compressSection,
    buildContextReport,
    setContextReport,
  } = require('./context-manager')

  const maxTokens = options.full ? null : (options.maxTokens === undefined ? 3000 : options.maxTokens)
  let finalSections = promptSections
  let budget = null

  if (maxTokens) {
    const totalTokens = promptSections.reduce((sum, s) => sum + estimateTokens(s.lines.join('\n')), 0)
    if (totalTokens > maxTokens) {
      budget = assignBudget(promptSections, maxTokens)
      finalSections = promptSections.map(s => {
        const action = budget[s.name]?.action || 'keep'
        if (action === 'elide') return { ...s, lines: [] }
        if (action === 'compress') {
          return { ...s, lines: compressSection(s.lines, budget[s.name].allocated) }
        }
        return s
      }).filter(s => s.lines.length > 0)
    }
  }

  if (options.contextReport) {
    if (!budget) {
      budget = {}
      for (const s of promptSections) {
        budget[s.name] = { action: 'keep', allocated: estimateTokens(s.lines.join('\n')) }
      }
    }
    const report = buildContextReport(promptSections, budget)
    setContextReport(report)
  }

  const lines = finalSections.flatMap(s => s.lines)

  if (options.contextReport) {
    const report = buildContextReport(promptSections, budget)
    lines.push('')
    lines.push('<!-- Context Report')
    lines.push(`Total: ${report.totalTokens} tokens | Budget: ${maxTokens || 'unlimited'}`)
    for (const s of report.sections) {
      lines.push(`  ${s.name}: ${s.used} used / ${s.allocated} allocated (${s.action})`)
    }
    lines.push('-->')
  }

  const promptText = lines.join('\n')
  const validation = validatePrompt(promptText)

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
      stackProfile: stackProfile ? {
        status: stackProfile.status,
        path: stackProfile.relativePath,
      } : null,
    },
  };
}

function verifyDataIntegrity(dataDir) {
  const manifestPath = path.join(dataDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return true;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  for (const [relativePath, expectedHash] of Object.entries(manifest)) {
    const filePath = path.join(dataDir, relativePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data integrity fail: missing file ${relativePath}`);
    }
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(`Data integrity fail: hash mismatch for ${relativePath}`);
    }
  }
  return true;
}

module.exports = { generatePrompt, parseRows, inferTaskUnderstanding, verifyDataIntegrity };
