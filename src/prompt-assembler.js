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
const { sanitizeCsvValue, neutralizeUserText } = require('./sanitize');

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
  const surface = /\b(?:admin|dashboard)\b/.test(lower)
    ? 'admin dashboard'
    : /\b(?:login|auth|signin|signup)\b/.test(lower)
      ? 'authentication surface'
      : /\b(?:design|ui|ux|page|screen|component|card)\b/.test(lower)
        ? 'UI surface'
        : 'requested code surface';
  const expected = /\b(?:design|ui|ux|dashboard|page|screen|visual)\b/.test(lower)
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
  const { inferMode } = require('./mode-router');
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

  // Admin/dashboard surface hints — generic guidance, not project-specific paths.
  // The next agent should detect the real paths from the repo it is working in.
  const lower = task.toLowerCase();
  const routeHints = /\b(?:admin|dashboard)\b/.test(lower)
    ? [
        'Locate the admin/dashboard route in this repo (e.g. an (admin) route group or a dashboard page component).',
        'Find the dashboard data layer: list/query hooks and the API client that feeds the widgets.',
        'Find the shared UI primitives (tables, cards, charts) the dashboard composes.',
        'Find the i18n/translation catalogs if the app is localized.',
        'Find any project UI/style contract or design-system doc and judge against it.',
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
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  SYSTEM CONTRACT',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Role: ${(sections.Role?.[0] || modeConfig.label).replace(/\[stack\]/g, stack)}`,
      `Mission: ${neutralizeUserText(task)}`,
      `Authority: ${modeConfig.authority}`,
      '',
      'Task Understanding:',
      ...taskUnderstanding.map(item => `  • ${item}`),
      '',
    ],
  })

  promptSections.push({
    name: 'CONTEXT WINDOW',
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
    SECTION_PRIORITIES,
  } = require('./context-manager')

  // Single source of truth: derive every section's budgeting priority from the
  // SECTION_PRIORITIES map instead of hardcoding it on each section literal.
  for (const s of promptSections) s.priority = SECTION_PRIORITIES[s.name] ?? 1

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

// Memoize per data dir so a multi-call CLI session / test run hashes the data
// files at most once, not on every generatePrompt invocation.
const _verifiedDirs = new Set();

/**
 * Tamper-detection for the bundled CSV data.
 * Strict (throws) only in CI / when PROMPT_BUILDER_VERIFY=1. In normal dev runs a
 * contributor editing a CSV without regenerating the manifest gets a one-time
 * warning instead of a hard failure (run `npm run manifest` to refresh).
 */
function verifyDataIntegrity(dataDir, options = {}) {
  if (_verifiedDirs.has(dataDir)) return true;
  const strict = options.strict ?? process.env.PROMPT_BUILDER_VERIFY === '1';

  const manifestPath = path.join(dataDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) { _verifiedDirs.add(dataDir); return true; }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  for (const [relativePath, expectedHash] of Object.entries(manifest)) {
    const filePath = path.join(dataDir, relativePath);
    let problem = null;
    if (!fs.existsSync(filePath)) {
      problem = `missing file ${relativePath}`;
    } else {
      const actualHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
      if (actualHash !== expectedHash) problem = `hash mismatch for ${relativePath}`;
    }
    if (problem) {
      if (strict) throw new Error(`Data integrity fail: ${problem}`);
      console.warn(`  ⚠ Data integrity warning: ${problem} (run \`npm run manifest\` to refresh)`);
      _verifiedDirs.add(dataDir);
      return false;
    }
  }
  _verifiedDirs.add(dataDir);
  return true;
}

module.exports = { generatePrompt, parseRows, inferTaskUnderstanding, verifyDataIntegrity };
