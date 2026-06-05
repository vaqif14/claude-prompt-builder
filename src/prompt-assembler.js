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
const { groundInRepo } = require('./codebase-grounding');

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

// Platform-aware grounding slots: a backend/service or data task must not be handed
// UI slots (route/page, design tokens, i18n, render states) and vice-versa.
function buildGroundingSlots(surface = {}) {
  const { isUi, isService, isData, isCli } = surface;
  const slots = [];
  slots.push('Target entry point — the file that owns this work; if it is a redirect, barrel, re-export, or thin wrapper, resolve to the true implementation');
  if (isUi) {
    slots.push('Component / view tree the surface renders');
    slots.push('Data layer feeding the UI: hooks, queries, stores, or API client');
    slots.push('Design tokens / style source to judge visuals against');
    slots.push('i18n / locale catalogs, if the project is localized');
    slots.push('UI state branches: loading, empty, error, and success');
  }
  if (isService) {
    slots.push('Public API / DTO / contract the surface exposes (do not change its shape during a refactor)');
    slots.push('Call graph: controller/handler → service → repository/persistence');
    slots.push('Transaction boundaries and the error/exception-handling strategy');
    slots.push('Domain invariants to preserve before refactoring: concurrency/locking, idempotency, money/amount math, scheduling/time, auth/authorization, append-only/audit data');
  }
  if (isData) {
    slots.push('Schema, indexes, and the migration set (treat already-applied migrations as immutable — add forward migrations only)');
    slots.push('Hot queries and their query plans');
  }
  if (isCli) {
    slots.push('Commands, flags, exit codes, and fixtures');
  }
  slots.push('Verification commands — detect the package manager / build tool from the lockfile / build file (pnpm-lock.yaml→pnpm, yarn.lock→yarn, package-lock.json→npm; build.gradle→Gradle, pom.xml→Maven, Cargo.toml→cargo, go.mod→go)');
  return slots.map(s => `  • ${s}`);
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
    getMulticaStyleTaskBoard,
    getDesignerRubric,
  } = require('./skill-matcher');

  const mode = inferMode(task, options.mode);
  const template = options.template || mode;
  const detectionTask0 = options.platform ? `${task} ${options.platform}` : task;

  const UI_IDS = ['web', 'ios', 'android', 'flutter', 'react-native', 'desktop'];
  const SERVICE_IDS = ['backend', 'node-express', 'nestjs', 'python', 'python-fastapi', 'python-django', 'ruby-rails', 'go', 'rust', 'dotnet', 'laravel', 'ai'];
  const DATA_IDS = ['db', 'data-ml'];
  const surfaceFromIds = (ids) => ({
    isUi: ids.some(id => UI_IDS.includes(id)),
    isService: ids.some(id => SERVICE_IDS.includes(id)),
    isData: ids.some(id => DATA_IDS.includes(id)),
    isCli: ids.includes('cli'),
  });

  // Codebase grounding: when a real repo path is given, READ the repo first and let it
  // drive stack/platform/surface — the repo scan is more reliable than task-text keyword
  // guessing (which misses casual or non-English wording). A cheap pre-detection only
  // seeds the build preference for grounding's token-less fallback.
  const preSurface = surfaceFromIds(detectPlatformsMixed(detectionTask0).map(p => p.id));
  const prePrefer = preSurface.isUi && !preSurface.isService ? 'js'
    : preSurface.isService && !preSurface.isUi ? 'jvm' : null;
  const grounding = options.cwd ? groundInRepo({ cwd: options.cwd, task, prefer: prePrefer }) : { grounded: false };

  // If grounding is confident about a surface the task wording never named, inject that
  // surface keyword into the detection string so platform, stack, complexity, skills,
  // council, and the task board all re-derive consistently — instead of contradicting
  // GROUNDED TARGETS (e.g. an AZ-worded frontend task detected as "general").
  let detectionTask = detectionTask0;
  if (grounding.grounded && grounding.surface && grounding.surface.confident
    && !(preSurface.isUi || preSurface.isService || preSurface.isData)) {
    const word = grounding.surface.isUi ? 'frontend'
      : grounding.surface.isService ? 'backend'
        : grounding.surface.isData ? 'database' : '';
    if (word) detectionTask = `${detectionTask0} ${word}`;
  }

  let stack = options.stack || detectStack(detectionTask);
  // Repo-detected, surface-aligned stack wins over a generic keyword guess.
  if (!options.stack && grounding.grounded && grounding.stackName && stack === 'general') {
    stack = grounding.stackName;
  }
  const platforms = detectPlatformsMixed(detectionTask);
  const analysis = analyzeTask(detectionTask);
  const modeConfig = getModeConfig(mode);

  // Surface kind drives platform-aware grounding, evidence, and review passes.
  const surface = surfaceFromIds(platforms.map(p => p.id));

  // Complexity floor: a task touching load-bearing invariants (locking, idempotency,
  // anonymity, money, timer, auth, migrations) is never trivial — keep it off Haiku.
  let complexity = analysis.complexity;
  if (grounding.grounded && complexity === 'Low'
    && (grounding.invariants || []).some(i => /\b(anonym|locking|idempotenc|reserve|money|amount|timer|audit|auth|eligibilit|security|migration)\b/i.test(i))) {
    complexity = 'Medium';
  }

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
  const skillPlan = getSkillInvocationPlan(task, template, analysis.domains, platforms, complexity, options);
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
  const agentCouncil = getAgentCouncil(task, mode, complexity, options, surface);
  const designerRubric = getDesignerRubric(task);
  const taskBoard = getMulticaStyleTaskBoard(task, mode, platforms, surface);

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

  if (grounding.grounded) {
    const g = grounding;
    const lines = [
      '═══════════════════════════════════════════════════════════════',
      '  GROUNDED TARGETS — auto-detected from the repo (verify before trusting)',
      '═══════════════════════════════════════════════════════════════',
      '',
    ];
    if (g.stack && g.stack.length) lines.push(`Detected stack: ${g.stack.join(', ')}`, '');
    if (g.build) {
      const cmds = [];
      if (g.build.typecheck) cmds.push(`typecheck=${g.build.typecheck}`);
      if (g.build.lint) cmds.push(`lint=${g.build.lint}`);
      if (g.build.test) cmds.push(`test=${g.build.test}`);
      if (g.build.build) cmds.push(`build=${g.build.build}`);
      lines.push(`Build tool: ${g.build.tool}${g.build.dir ? ` (in ${g.build.dir})` : ''}`);
      lines.push(`Real commands: ${cmds.join(' | ') || 'detect from project'}`, '');
    }
    if (g.targets && g.targets.length) {
      lines.push(
        g.targetsBySize
          ? 'Likely refactor candidates (ranked by lines of code, not task-matched — confirm relevance before acting):'
          : 'Likely target files (ranked by task match — confirm the right one):',
        ...g.targets.map(t => `  • ${t}`), '');
    } else if (g.roots && g.roots.length) {
      lines.push(`No single surface matched the task wording — scan these source roots: ${g.roots.join(', ')}`, '');
    }
    if (g.invariants && g.invariants.length) {
      lines.push('Project invariants / hard rules (from CLAUDE.md/AGENTS.md — do NOT weaken):', ...g.invariants.map(i => `  • ${i}`), '');
    }
    lines.push('These are heuristic detections — confirm each file:line, and resolve any "redirect/stub" or "barrel/re-export" note to the true implementation before acting.', '');
    promptSections.push({ name: 'GROUNDED TARGETS', lines });
  }

  promptSections.push({
    name: 'GROUNDING CONTRACT',
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  GROUNDING CONTRACT — RESOLVE BEFORE EXECUTING',
      '═══════════════════════════════════════════════════════════════',
      '',
      ...(grounding.grounded
        ? ['Concrete detections are in GROUNDED TARGETS above — verify each, then additionally resolve these to real file:line:']
        : ['This prompt is generated from heuristics and is NOT yet grounded in the target repo.',
           'Before doing the work, read the actual codebase and resolve these to real file:line targets:']),
      ...buildGroundingSlots(surface),
      '',
      'Do not begin work, and do not present a verdict, until these are resolved to concrete paths.',
      '',
    ],
  })

  if (!isReadOnly) {
    promptSections.push({
      name: 'WRITE SAFETY GATE',
      lines: [
        '═══════════════════════════════════════════════════════════════',
        '  WRITE SAFETY GATE — TAKES PRECEDENCE OVER THE EXECUTION PLAN',
        '═══════════════════════════════════════════════════════════════',
        '',
        'These gates override the Execution Plan below. Do not start editing until they are satisfied.',
        '  • Plan-Approval Gate: if the change spans multiple files or touches shared/critical code, present the change/deviation list and WAIT for explicit user approval before editing. Do not plan and fix in the same pass unless the user already approved fixes.',
        '  • Invariant Fence: before changing code, discover and characterize (with tests) the load-bearing invariants of the touched paths — concurrency/locking, idempotency, money/amount math, scheduling/time, auth/authorization, append-only/audit data, and already-applied DB migrations. Do NOT weaken any of them; escalate before changing locking, transaction semantics, or an applied migration.',
        '  • Behavior-preserving means same observable outputs/contracts. Performance fixes (e.g. resolving N+1) that keep outputs identical are allowed and expected — capture a before/after measurement; never fabricate metrics.',
        '',
      ],
    })
  }

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
      'Required Skills To Invoke (in this order):',
      ...skillPlan.map((item, index) => `  ${index + 1}. ${item.skill} — ${item.reason}. ${item.instruction}`),
      '',
      'Rule: Do not continue with the audit/build until each relevant skill above has been invoked, marked unavailable with a reason, or marked N/A (not applicable to this task\'s scope) — invoke only what the task actually needs.',
      'Rule: Do not claim a skill was used unless its guidance was actually loaded/read or its workflow was followed.',
      '',
    ],
  })

  promptSections.push({
    name: 'MULTI-AGENT TASK BOARD',
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  MULTI-AGENT TASK BOARD',
      '═══════════════════════════════════════════════════════════════',
      '',
      'Use this as a managed-agent task board: split the work into owned task cards, run independent cards in parallel when possible, track status, collect artifacts, then synthesize.',
      'Task Card Schema: id | owner | skill | title | status(todo/in_progress/blocked/done) | depends_on | artifact',
      ...taskBoard.map(card => `  • ${card.id} | ${card.owner} | skill=${card.skill} | ${card.title} | ${card.status} | depends_on=${card.dependsOn} | artifact=${card.artifact}`),
      '',
      'Skill Binding Rule: every task card names the skill its owner must load/invoke before executing the card. An agent must not execute its card on intuition alone — load the assigned skill first; if it is unavailable, run find-skills to obtain a trusted equivalent (or mark it unavailable with a reason) before proceeding.',
      'Parallelization Rule: run cards with the same dependency in parallel only if they touch different files/surfaces or are read-only review passes.',
      'Conflict Rule: if two agents need to edit the same file, Coordinator must serialize the work and assign one owner.',
      'Handoff Rule: every agent must return findings, touched files, evidence, blockers, and recommended next task.',
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
      `Task complexity: ${complexity} | Default model: ${selectModel(task, complexity, options)}`,
      ...agentCouncil.map((agent, index) => `  ${index + 1}. ${agent.name} — ${agent.model} (${complexity} complexity)`),
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
      ...(!isReadOnly ? ['  • Write-safety gates apply (see WRITE SAFETY GATE near the top): plan approval before editing, and the invariant fence.'] : []),
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
      '  • Stop if evidence cannot be collected due to missing prerequisites (dev server, emulator, backend, database, or credentials)',
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
      `  • Every claim must be backed by file:line, ${surface.isUi ? 'screenshot, ' : ''}command output, or log`,
      `  • "Working" requires ${surface.isUi ? 'the resolved target surface to actually render with real data (screenshot + clean console/network)' : 'the changed code path proven by passing tests plus logs / traces / query output (not merely that the project compiles)'} — not merely commands exiting 0; partial pass = "Working with issues"`,
      '  • A build/test failure outside the target surface is a separate finding, not this surface\'s verdict',
      '  • Blocked = missing prerequisites (auth, running services, database, data, or credentials) documented precisely',
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
  // SECTION_PRIORITIES map. Then protect the section(s) that embody the chosen
  // mode's core deliverable so token budgeting never elides them first
  // (e.g. a visual audit must keep its Designer Rubric, a review must keep its
  // Agent Review Council).
  const MODE_CRITICAL = {
    'design-review': ['DESIGNER RUBRIC', 'AGENT REVIEW COUNCIL'],
    'security-review': ['AGENT REVIEW COUNCIL'],
    'architecture-review': ['AGENT REVIEW COUNCIL'],
    'performance-review': ['AGENT REVIEW COUNCIL'],
  }
  const critical = new Set(MODE_CRITICAL[mode] || [])
  if (designerRubric.length) critical.add('DESIGNER RUBRIC')
  for (const s of promptSections) {
    s.priority = critical.has(s.name) ? 0 : (SECTION_PRIORITIES[s.name] ?? 1)
  }

  const maxTokens = options.full ? null : (options.maxTokens === undefined ? 5500 : options.maxTokens)
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
      complexity,
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
