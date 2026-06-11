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
const { selectWorkflowPattern } = require('./workflow-router');
const { scoreContextDiet } = require('./context-diet');
const { getInstallProfile } = require('./install-profiles');
const { buildQualityBar, assessPromptQuality } = require('./quality-rubric');
const { loadCsv, loadMarkdown, renderTemplate } = require('./data-loader');

function parseRows(file) {
  if (!fs.existsSync(file)) return [];
  const records = loadCsv(file, { header: false });
  if (records.length && /^(section|group|domain|category|key)$/i.test(records[0].values[0] || '')) {
    records.shift();
  }
  return records.map((record) => {
    const parts = record.values;
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

function clarifyDecision(task, grounding) {
  const targets = (grounding && grounding.targets || [])
    .map(target => String(target).replace(/\s+\((?:redirect|barrel|large\/complex).*$/, ''));
  if (!grounding || !grounding.targetsBySize || targets.length < 2) return null;
  const vagueReference = /\b(?:this|that|it|these|those|bunu|bura|burani|buranı|onu)\b/i.test(task);
  if (!vagueReference) return null;
  return { options: targets.slice(0, 2) };
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

// Mode-shaped phase skeletons for the TASK PLAN. We take spec-kit's tasks.md discipline
// (atomic, phased, dependency-ordered tasks with exact file:line, [P] parallel markers, and
// per-task acceptance + checkpoints) and reject the rest of its methodology — the CLI emits the
// skeleton; the SKILL fills the file:line + acceptance from code it actually reads.
const TASK_PLAN_PHASES = {
  refactor: ['Characterize — pin current behavior with tests (no production edits)', 'Extract / split in small steps (one safe transform per task)', 'Verify no behavior change + cleanup'],
  bugfix: ['Reproduce — a failing test that captures the bug', 'Minimal fix at the root cause', 'Regression-proof + verify'],
  feature: ['Setup & contracts (entities / DTOs / migration stub)', 'User Story 1 (P1) — tests then implementation', 'User Story 2 (P2)', 'Polish & docs'],
};
const DEFAULT_TASK_PHASES = ['Setup & prerequisites', 'Core implementation', 'Verify & document'];

// `<RESOLVE — …>` markers are filled by the SKILL after reading code (mirrors PROBLEM ANALYSIS).
// Prose never contains the literal sentinel, so plan-readiness only trips on real, unfilled slots.
function buildTaskPlan(mode, isReadOnly, specMicroBlock) {
  const out = [
    '═══════════════════════════════════════════════════════════════',
    '  TASK PLAN — spec-kit detail; the prompt is NOT done while any RESOLVE marker remains',
    '═══════════════════════════════════════════════════════════════',
    '',
  ];
  if (isReadOnly) {
    out.push(
      'A read-only review has no edit tasks — it produces a findings ledger. Fill each marker from',
      'evidence you actually collected (commands, file:line, screenshots). Recommend fixes as separate',
      'tasks; do not edit in this pass.',
      '',
      'Legend: [ID] [Sev] <finding> → evidence: <cmd | file:line | screenshot> | rec: <fix as a separate task>',
      '',
      'Phase 1 — Evidence collection',
      '  • What to inspect / commands to run: <RESOLVE — the concrete checks for this surface>',
      'Phase 2 — Findings ledger',
      '  [ ] F001 [Sev?] <RESOLVE — finding> → evidence: <RESOLVE — cmd/file:line/screenshot> | rec: <RESOLVE — fix as a separate task>',
      '  [ ] F002 [Sev?] <RESOLVE — finding> → evidence: <RESOLVE> | rec: <RESOLVE>',
      '  ── Checkpoint: every finding carries a severity and concrete evidence; no claim without proof.',
      '',
    );
    return out;
  }
  if (specMicroBlock) {
    out.push(
      'Spec (fill from the intent + the code you read — keep it bound to real symbols, not generic):',
      '  • User stories: US1 (P1) <RESOLVE — story + independent test>; US2 (P2) <RESOLVE>',
      '  • Functional requirements: FR-001 <RESOLVE — MUST-phrased, testable>; FR-002 <RESOLVE>',
      '  • Success criteria: SC-001 <RESOLVE — measurable, ties to an FR>',
      '  • Edge cases to handle: <RESOLVE — the inputs/states that break the naive version>',
      '  • Non-goals (explicitly out of scope this task): <RESOLVE>',
      '',
    );
  }
  out.push(
    'FILE MAP — list every created/modified file before task rows',
    '  • <RESOLVE — path/to/file>: <RESOLVE — one-line responsibility> | action: <create|modify>',
    '',
    'Phase skeleton is from the mode; YOU (having read the code) fill the description, file:line,',
    'verification, conventions, dependencies, and per-task acceptance. A row that still has a RESOLVE marker, or names no',
    'concrete file, is unfinished. Mark [P] only when tasks touch different files with no shared dep.',
    '',
    'Legend: [ID] [P?] <one action> → <one primary file:line> | verify: <fresh command/test> | docs: <convention|n/a> | depends_on: <ids|none> | acceptance: <observable evidence>',
    '',
  );
  const phases = TASK_PLAN_PHASES[mode] || DEFAULT_TASK_PHASES;
  let id = 1;
  phases.forEach((phase, idx) => {
    const pid = String(id).padStart(3, '0'); id++;
    out.push(`Phase ${idx + 1} — ${phase}`);
    out.push(`  [ ] T${pid} [P] <RESOLVE — one 2–5 minute action> → <RESOLVE — one file:line> | verify: <RESOLVE — command/test> | docs: <RESOLVE — convention or n/a> | depends_on: none | acceptance: <RESOLVE — observable evidence>`);
    if (idx === 0) {
      const pid2 = String(id).padStart(3, '0'); id++;
      out.push(`  [ ] T${pid2}    <RESOLVE — one action> → <RESOLVE — one file:line> | verify: <RESOLVE> | docs: <RESOLVE> | depends_on: T${pid} | acceptance: <RESOLVE>`);
    }
    out.push(`  ── Checkpoint: <RESOLVE — what is observably true/green after this phase>`);
  });
  out.push('', 'Dependency order: tests → models/contracts → services → endpoints/UI; parallelize only across files.', '');
  return out;
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
    classifySkills,
    buildSkillSuggestions,
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

  const dataDir = options.dataDir || path.join(__dirname, '..', 'data');

  if (!options.dataDir || options.verifyDataIntegrity) verifyDataIntegrity(dataDir);
  const contract = name => loadMarkdown(path.join(dataDir, 'contracts', name)).trim();
  const contractRows = name => loadCsv(path.join(dataDir, 'contracts', name), { header: true, allowTemplates: true });

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

  // Three-state skill classification (A3) + suggestions (A4). `options.discovery` is the merged
  // model from src/skill-discovery.js (computed by the CLI/caller; null when discovery did not run,
  // in which case static matches are honestly labeled "unverified").
  const discovery = options.discovery || null;
  const annotatedPlan = classifySkills(skillPlan, discovery);
  const skillSuggestions = buildSkillSuggestions(
    annotatedPlan,
    discovery,
    options.dismissedSkills || [],
    task,
    { dataDir }
  );
  const excludedSkillSuggestions = skillSuggestions.excluded || [];
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
  const agentCouncil = getAgentCouncil(task, mode, complexity, options, surface, platforms);
  const designerRubric = getDesignerRubric(task);
  const taskBoard = getMulticaStyleTaskBoard(task, mode, platforms, surface);

  const isReadOnly = ['audit', 'design-review', 'architecture-review', 'security-review', 'performance-review', 'release-check', 'agent-readiness', 'tooling-review', 'skill-review'].includes(mode);
  const clarify = clarifyDecision(task, grounding);

  // Workflow pattern (Anthropic "Building Effective Agents"): tell the next agent which
  // composable workflow shape to run, not only which skills to load. Computed from the
  // resolved mode, complexity, surface count, and council size.
  const workflow = selectWorkflowPattern({ mode, complexity, platforms, agentCount: agentCouncil.length, task });
  const startingMode = isReadOnly ? 'REVIEW'
    : (workflow.pattern === 'orchestrator-workers' || complexity === 'High' ||
      (grounding.targets || []).length > 1 || (grounding.invariants || []).length > 0)
      ? 'PLANNING'
      : 'EXECUTION';

  // Selective install profile (opt-in via --profile): a small curated skill set for the
  // project shape, capped and approval-required — never a bulk mega-setup.
  const installProfile = getInstallProfile(options.profile);

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
    name: 'WORKFLOW PATTERN',
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  WORKFLOW PATTERN — simple/composable before autonomous',
      '═══════════════════════════════════════════════════════════════',
      '',
      `Pattern: ${workflow.pattern}`,
      `Shape: ${workflow.description}`,
      `Why: ${workflow.rationale}`,
      ...(workflow.pattern === 'orchestrator-workers' || workflow.pattern === 'parallel-review'
        ? ['', 'Subagent Dispatch Protocol:', ...contract('subagent-protocol.md').split('\n').map(line => `  • ${line}`)]
        : []),
      '',
    ],
  })

  promptSections.push({
    name: 'QUALITY BAR',
    lines: buildQualityBar(isReadOnly),
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
    name: 'EXPLORATION CONTRACT',
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  EXPLORATION CONTRACT',
      '═══════════════════════════════════════════════════════════════',
      '',
      ...contract('exploration.md').split('\n').map(line => `  • ${line}`),
      '',
    ],
  })

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
      'Resolve missing slots through the Exploration Contract above, never by guessing.',
      'Do not begin work, and do not present a verdict, until these are resolved to concrete paths.',
      '',
    ],
  })

  if (clarify) {
    promptSections.push({
      name: 'CLARIFY-FIRST GATE',
      lines: [
        '═══════════════════════════════════════════════════════════════',
        '  CLARIFY-FIRST GATE',
        '═══════════════════════════════════════════════════════════════',
        '',
        ...renderTemplate(contract('clarify-first.md'), {
          OPTION_A: clarify.options[0],
          OPTION_B: clarify.options[1],
        }).split('\n'),
        '',
      ],
    })
  }

  // The diagnostic center. Orchestration scaffold is worthless without it: the agent that
  // produces this prompt MUST open the resolved targets, diagnose the real problem, and
  // state the concrete fix — not punt all understanding to the next agent. The CLI cannot
  // read code (it greps), so it emits <RESOLVE> slots; the SKILL (running in Claude Code,
  // which CAN read files) fills them before handing the prompt off. Solution-readiness in
  // the validator flips to "ready" only once these are filled.
  promptSections.push({
    name: 'PROBLEM ANALYSIS',
    lines: [
      '═══════════════════════════════════════════════════════════════',
      `  PROBLEM ANALYSIS${isReadOnly ? '' : ' & SOLUTION DIRECTION'} — fill from the code; the prompt is NOT done while this is empty`,
      '═══════════════════════════════════════════════════════════════',
      '',
      'This is the center of the prompt. OPEN the resolved target file(s) above and replace every',
      'RESOLVE marker below with a concrete, code-grounded statement. A prompt that still contains an',
      'unfilled marker here — or that uses generic verbs ("identify the smell", "map the structure")',
      'in place of a real finding — is UNFINISHED: do not hand it off or act on it.',
      '',
      `  • Root cause / primary ${isReadOnly ? 'finding' : 'problem'} (path:line): <RESOLVE — read the file, name the actual ${isReadOnly ? 'issue at a line, or confirm there is none' : 'smell/bug at a line'}>`,
      '  • Why it matters in THIS code (concrete, not a generic rule): <RESOLVE — the real consequence here>',
      '  • Expected vs actual (what the code should do vs what it does): <RESOLVE>',
      ...(isReadOnly
        ? ['  • Required fix direction IF an issue exists (specific): <RESOLVE — name the edit, e.g. "route identity through BidderLabelChip at <file:line>"; or "no change — evidence below">']
        : ['  • Hypothesis (most likely cause, stated before fixing): <RESOLVE>',
           '  • What was already tried / ruled out (if anything): <RESOLVE — or "n/a, first attempt">',
           '  • Solution direction (specific edit): <RESOLVE — e.g. "extract <method> from <file:line>", "split <class> into <X>/<Y>", "fix N+1 at <line> with JOIN FETCH", "change <A> → <B>">',
           '  • First file:line to edit: <RESOLVE>']),
      '  • Invariants the change must preserve (from GROUNDED TARGETS / hard rules): <RESOLVE>',
      '',
    ],
  })

  if (!isReadOnly) {
    const operatingMode = renderTemplate(contract('operating-modes.md'), { START_MODE: startingMode });
    const safetyRows = contractRows('write-safety.csv');
    promptSections.push({
      name: 'WRITE SAFETY GATE',
      lines: [
        '═══════════════════════════════════════════════════════════════',
        '  WRITE SAFETY GATE — TAKES PRECEDENCE OVER THE EXECUTION PLAN',
        '═══════════════════════════════════════════════════════════════',
        '',
        ...operatingMode.split('\n'),
        '',
        'These gates override the Execution Plan below. Do not start editing until they are satisfied.',
        ...safetyRows.map(row => `  • ${row.text}`),
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
      'Situational Context (fill from the repo — drives context_provision to 9–10):',
      '  • Why it matters / business context: <RESOLVE — the user-facing or business consequence>',
      '  • Related systems / dependencies the change touches: <RESOLVE>',
      '  • Environment specifics (runtime, config, feature flags) if relevant: <RESOLVE — or n/a>',
      '  • Which tests to verify against: <RESOLVE — the exact suite/file that proves this>',
      '',
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

  if (mode === 'skill-review') {
    const rubric = loadCsv(path.join(dataDir, 'skill-review-rubric.csv'), {
      header: true,
      requiredColumns: ['axis', 'check', 'zero_if'],
    });
    promptSections.push({
      name: 'SKILL REVIEW RUBRIC',
      lines: [
        '═══════════════════════════════════════════════════════════════',
        '  SKILL REVIEW RUBRIC',
        '═══════════════════════════════════════════════════════════════',
        '',
        ...rubric.map(row => `  • ${row.axis}: ${row.check} Zero score when: ${row.zero_if}.`),
        '',
      ],
    })
  }

  if (installProfile) {
    promptSections.push({
      name: 'SELECTIVE INSTALL PROFILE',
      lines: [
        '═══════════════════════════════════════════════════════════════',
        `  SELECTIVE INSTALL PROFILE — ${installProfile.label} (curated, capped, approval-required)`,
        '═══════════════════════════════════════════════════════════════',
        '',
        'A small curated set for this project shape — NOT a bulk install. Each item earns its place:',
        ...installProfile.items.map(i => `  • ${i.name} — ${i.why}`),
        '',
        'Install rule: these are recommendations only. Ask the user before running any install; prefer',
        'already-installed equivalents found in skill discovery. Add with `npx skills add <name> -g -y`',
        'then `/reload-skills`. Do not install items the task does not actually need.',
        '',
      ],
    })
  }

  const skillStateLabel = (item) => {
    if (item.statusState === 'installed') {
      const rel = path.relative(options.cwd || process.cwd(), item.path || '');
      return `✓ installed (${rel && !rel.startsWith('..') ? rel : (item.path || 'local')})`;
    }
    if (item.statusState === 'suggested') return `⤓ suggested (not installed) — source: ${item.source}`;
    return '? unverified — discovery unavailable; verify via find-skills before relying on it';
  };
  const discoveryNote = !discovery
    ? 'Discovery did not run (offline / --no-discover). Static matches below are labeled "? unverified" — verify availability with find-skills before relying on them.'
    : discovery.status === 'unavailable'
      ? `Ecosystem discovery unavailable (${discovery.reason}); local scan still applied. Uncheckable matches are "? unverified".`
      : `Discovery ran (local scan + ecosystem${discovery.fromCache ? ', cached' : ''}). Statuses below are real.`;

  promptSections.push({
    name: 'MATCHED SKILLS',
    lines: [
      '═══════════════════════════════════════════════════════════════',
      '  MATCHED SKILLS — ✓ installed · ⤓ suggested (not installed) · ? unverified',
      '═══════════════════════════════════════════════════════════════',
      '',
      discoveryNote,
      '',
      ...analysis.domains.map(d => `  • ${d.skill} (${d.domain}) — ${d.priority} priority`),
      '',
      'Required Skills To Invoke (installed first, then suggested, then unverified):',
      ...annotatedPlan.map((item, index) => [
        `  ${index + 1}. [${item.statusState}] ${item.skill} — ${skillStateLabel(item)}`,
        `       ${item.reason}. ${item.instruction}`,
      ].join('\n')),
      '',
      ...contract('gate-order.md').split('\n'),
      '',
    ],
  })

  if (skillSuggestions.length) {
    promptSections.push({
      name: 'SKILL SUGGESTIONS',
      lines: [
        '═══════════════════════════════════════════════════════════════',
        '  SKILL SUGGESTIONS — approval required (never auto-installed)',
        '═══════════════════════════════════════════════════════════════',
        '',
        'You can execute this request more effectively with the skills below. Each is NOT installed.',
        'Installing is a suggestion only — run the install command ONLY after the user approves.',
        '',
        ...skillSuggestions.flatMap(s => [
          `  • Skill: ${s.name}            (source: ${s.source})`,
          `    Fits because: ${s.fits}`,
          `    ${s.trustNote}`,
          `    Install: ${s.install}        ← run only after user approves`,
          `    Then: /reload-skills and rerun: ${s.rerun}`,
          '',
        ]),
        ...(excludedSkillSuggestions.length ? [
          'Excluded by trust screen:',
          ...excludedSkillSuggestions.map(s => `  • ${s.name} — ${s.risk} risk: ${s.patterns.join(', ')}`),
          '',
        ] : []),
      ],
    })
  }

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
      ...agentCouncil.flatMap((agent, index) => [
        `  ${index + 1}. Role: ${agent.role}`,
        `     Scope: ${agent.scope}`,
        `     Out of scope: ${agent.outOfScope}`,
        `     Evidence: ${agent.requiredEvidence} | Skill: ${agent.primarySkill}`,
      ]),
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

  // Keep the section key 'EXECUTION PLAN' (SECTION_PRIORITIES / budget refer to it); the body is
  // now the spec-kit-style TASK PLAN. feature mode gets a small US/FR/SC spec micro-block.
  promptSections.push({
    name: 'EXECUTION PLAN',
    lines: buildTaskPlan(mode, isReadOnly, mode === 'feature'),
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

  const commandFor = key => {
    const cmd = grounding.build && grounding.build[key];
    if (!cmd) return `${key} command not detected; resolve before claim`;
    return grounding.build.dir ? `(cd ${grounding.build.dir} && ${cmd})` : cmd;
  };
  const evidenceRows = contractRows('evidence-claims.csv').map(row => ({
    ...row,
    required: renderTemplate(row.required, {
      TEST_COMMAND: `\`${commandFor('test')}\``,
      BUILD_COMMAND: `\`${commandFor('build')}\``,
    }),
  }));
  promptSections.push({
    name: 'VERIFICATION CONTRACT',
    lines: [
      '═══════════════════════════════════════════════════════════════',
      `  VERIFICATION CONTRACT — ${isReadOnly ? 'findings evidence' : 'Iron Law'}`,
      '═══════════════════════════════════════════════════════════════',
      '',
      ...(isReadOnly ? contract('verification-read-only.md') : contract('verification-write.md')).split('\n'),
      '',
      '| Claim | Required evidence | Not sufficient |',
      '|---|---|---|',
      ...evidenceRows.map(row => `| ${row.claim} | ${row.required} | ${row.not_sufficient} |`),
      '',
      `Blocked-by: name the exact missing prerequisite — ${surface.isUi ? 'dev server, ' : ''}auth/credentials, running services, database, seed data, sandbox/network, or missing tooling.`,
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
      `  • ${contractRows('output-leads.csv').find(row => row.kind === (isReadOnly ? 'read-only' : 'write')).text}`,
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
    'skill-review': ['SKILL REVIEW RUBRIC', 'AGENT REVIEW COUNCIL'],
  }
  const critical = new Set(MODE_CRITICAL[mode] || [])
  if (designerRubric.length) critical.add('DESIGNER RUBRIC')
  for (const s of promptSections) {
    s.priority = critical.has(s.name) ? 0 : (SECTION_PRIORITIES[s.name] ?? 1)
  }

  const maxTokens = options.full ? null : (options.maxTokens === undefined ? 6000 : options.maxTokens)

  // Context diet: score the FULL section set (pre-budgeting) for context pressure and bloat.
  // Diagnostic only — it never elides; it tells the operator whether the prompt is lean/ok/heavy
  // and what to trim. Budget reference is the active maxTokens, or the default when --full.
  const contextDiet = scoreContextDiet(promptSections, {
    maxTokens: maxTokens || (options.maxTokens === undefined ? 6000 : options.maxTokens) || 6000,
    stackProfileStatus: stackProfile ? stackProfile.status : null,
  })

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

  const preReportText = finalSections.flatMap(s => s.lines).join('\n')
  const qualityRubric = assessPromptQuality(preReportText)
  const lines = finalSections.flatMap(s => s.lines)

  if (options.contextReport) {
    const report = buildContextReport(promptSections, budget)
    lines.push('')
    lines.push('<!-- Context Report')
    lines.push(`Total: ${report.totalTokens} tokens | Budget: ${maxTokens || 'unlimited'}`)
    lines.push(`Context diet: ${contextDiet.grade.toUpperCase()} (~${contextDiet.estTokens}t in ${contextDiet.sectionCount} sections) | recommended --max-tokens ${contextDiet.recommendedMaxTokens}`)
    for (const w of contextDiet.warnings) {
      lines.push(`  ⚠ ${w}`)
    }
    lines.push(`Quality rubric (dev-metrics): ${qualityRubric.covered}/${qualityRubric.total} dimensions covered`)
    for (const g of qualityRubric.gaps) {
      lines.push(`  ⚠ ${g}`)
    }
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
      agents: agentCouncil.length,
      readOnly: isReadOnly,
      workflowPattern: workflow.pattern,
      contextDiet: {
        grade: contextDiet.grade,
        estTokens: contextDiet.estTokens,
        sectionCount: contextDiet.sectionCount,
        toolSkillSections: contextDiet.toolSkillSections,
        recommendedMaxTokens: contextDiet.recommendedMaxTokens,
        warnings: contextDiet.warnings,
      },
      installProfile: installProfile ? installProfile.label : null,
      discovery: discovery ? { status: discovery.status, reason: discovery.reason || null, fromCache: Boolean(discovery.fromCache), installed: discovery.installed.length, available: discovery.available.length } : null,
      skillSuggestions,
      excludedSkillSuggestions,
      clarify,
      qualityRubric: {
        covered: qualityRubric.covered,
        total: qualityRubric.total,
        weakest: qualityRubric.weakest,
        gaps: qualityRubric.gaps,
      },
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
