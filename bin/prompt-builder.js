#!/usr/bin/env node
const { generatePrompt, searchData, validatePrompt, listModes, detectPlatformsMixed } = require('../src/index');
const sessionStore = require('../src/session-store');
const {
  createSession, saveTurn, listSessions, resumeSession, recordOutcome,
} = sessionStore;
const { buildStats, buildFeedbackReport } = require('../src/session-analytics');
const { categorizeError } = require('../src/error-handler');
const fs = require('fs');
const chalk = require('../src/ansi');
const pkg = require('../package.json');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function hr(color = 'gray') {
  const colors = { gray: '\x1b[90m', cyan: '\x1b[36m', green: '\x1b[32m' };
  console.log(colors[color] || colors.gray, '─'.repeat(60), RESET);
}

function box(title, lines, color = 'cyan') {
  const colors = { cyan: '\x1b[36m', green: '\x1b[32m', gray: '\x1b[90m' };
  const c = colors[color] || colors.cyan;
  const width = Math.max(title.length + 4, ...lines.map(l => l.length + 4));
  const top = `┌${'─'.repeat(width - 2)}┐`;
  const mid = lines.map(l => `│ ${l.padEnd(width - 4)} │`);
  const bot = `└${'─'.repeat(width - 2)}┘`;
  console.log('');
  console.log(c + top + RESET);
  console.log(c + `│ ${BOLD}${title}${RESET}${c}${' '.repeat(width - 4 - title.length)} │` + RESET);
  console.log(c + `├${'─'.repeat(width - 2)}┤` + RESET);
  for (const l of mid) console.log(c + l + RESET);
  console.log(c + bot + RESET);
}

function showHelp() {
  box(`prompt-builder v${pkg.version}`, [
    chalk.gray('Universal agent orchestration planner for coding agents'),
    '',
    chalk.white('Author:  ') + chalk.cyan('Vaqif Gulmammadov'),
    chalk.white('GitHub:  ') + chalk.cyan('github.com/vaqif14/claude-prompt-builder'),
  ], 'cyan');

  console.log(`
${chalk.bold('Usage:')}
  ${chalk.green('prompt-builder')} "${chalk.yellow('<task description>')}"                              ${chalk.gray('# Generate prompt')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--mode')} <mode> "${chalk.yellow('<task>')}"                        ${chalk.gray('# Use specific mode')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--platform')} <platform> "${chalk.yellow('<task>')}"                ${chalk.gray('# Override platform')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--compact')} "${chalk.yellow('<task>')}"                            ${chalk.gray('# Minimal output')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--json')} "${chalk.yellow('<task>')}"                               ${chalk.gray('# JSON output')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--save')} <file> "${chalk.yellow('<task>')}"                       ${chalk.gray('# Save to file')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--save-draft')} <file> "${chalk.yellow('<task>')}"                 ${chalk.gray('# Explicitly save an unresolved draft')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--print-skills-only')} "${chalk.yellow('<task>')}"                 ${chalk.gray('# Output matched skills')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--stack')} <stack> "${chalk.yellow('<task>')}"                       ${chalk.gray('# Override stack detection')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--backend')} "${chalk.yellow('<task>')}"                             ${chalk.gray('# Force backend context')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--database')} <db> "${chalk.yellow('<task>')}"                       ${chalk.gray('# Force database context')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--init-stack-profile')} ${chalk.cyan('--stack')} <stack>               ${chalk.gray('# Create stack profile MD only')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--refresh-stack-profile')} "${chalk.yellow('<task>')}"                ${chalk.gray('# Regenerate stack profile MD')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--no-stack-cache')} "${chalk.yellow('<task>')}"                       ${chalk.gray('# Disable stack profile cache')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--model')} <model> "${chalk.yellow('<task>')}"                       ${chalk.gray('# Override model selection (haiku, sonnet, opus)')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--session-id')} <id> "${chalk.yellow('<task>')}"                    ${chalk.gray('# Resume existing session')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--list-sessions')}                                   ${chalk.gray('# Show recent sessions')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--max-tokens')} <n> "${chalk.yellow('<task>')}"                      ${chalk.gray('# Set token budget (default: 6000)')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--full')} "${chalk.yellow('<task>')}"                                ${chalk.gray('# Disable token compression')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--context-report')} "${chalk.yellow('<task>')}"                       ${chalk.gray('# Print token usage + context-diet breakdown')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--profile')} <web|backend|mobile|ai-agent|hackathon> "${chalk.yellow('<task>')}" ${chalk.gray('# Curated, capped install profile')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--trust-details')} <skill>                         ${chalk.gray('# Static trust-screen details')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--stats')}                                         ${chalk.gray('# Local session statistics')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--record-outcome')} <id> <success|partial|fail> [note] ${chalk.gray('# Record result')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--feedback-report')}                               ${chalk.gray('# Local template feedback signals')}

${chalk.bold('Modes:')}
  ${chalk.yellow('feature')}            ${chalk.gray('Feature implementation (default)')}
  ${chalk.yellow('audit')}              ${chalk.gray('Evidence-based review')}
  ${chalk.yellow('bugfix')}             ${chalk.gray('Diagnosis and fix')}
  ${chalk.yellow('refactor')}           ${chalk.gray('Code modernization')}
  ${chalk.yellow('design-review')}      ${chalk.gray('Visual/design audit')}
  ${chalk.yellow('architecture-review')} ${chalk.gray('Structure and coupling audit')}
  ${chalk.yellow('security-review')}    ${chalk.gray('Security vulnerability audit')}
  ${chalk.yellow('performance-review')} ${chalk.gray('Performance and profiling audit')}
  ${chalk.yellow('release-check')}      ${chalk.gray('Release readiness verification')}
  ${chalk.yellow('prd-to-tasks')}       ${chalk.gray('PRD decomposition into tasks')}
  ${chalk.yellow('hackathon')}          ${chalk.gray('Domain-first narrow MVP + demo proof')}
  ${chalk.yellow('agent-readiness')}    ${chalk.gray('.claude portfolio audit (skills/hooks/MCP)')}
  ${chalk.yellow('tooling-review')}     ${chalk.gray('MCP/CLI tool & auth readiness audit')}
  ${chalk.yellow('skill-review')}       ${chalk.gray('Agent-skill quality / bloat review')}

${chalk.bold('Other Commands:')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--search')} <query>           ${chalk.gray('# Search data catalog')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--validate')} <file>          ${chalk.gray('# Validate prompt file')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--list-modes')}               ${chalk.gray('# List all modes')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--list-stacks')}              ${chalk.gray('# List available stacks')}
`);
}

function printTaskList(tasks, activeIndex = 0) {
  console.log('');
  hr('cyan');
  console.log(`  ${chalk.bold.white('⚡ Execution Plan')}`);
  hr('cyan');
  for (let i = 0; i < tasks.length; i++) {
    const isActive = i === activeIndex;
    const prefix = isActive ? chalk.cyan('  ❄️  ') : chalk.gray('  ☐  ');
    const text = isActive ? chalk.bold.white(tasks[i]) : chalk.white(tasks[i]);
    console.log(`${prefix}${text}`);
  }
  hr('cyan');
}

function printMetadataCard(meta, validation) {
  const scoreColor = validation.score >= 80 ? chalk.green : validation.score >= 50 ? chalk.yellow : chalk.red;
  const lines = [
    chalk.white('Field').padEnd(16) + ' │ ' + chalk.white('Value'),
    '─'.repeat(16) + '─┼─' + '─'.repeat(36),
    chalk.gray('Mode').padEnd(16) + ' │ ' + chalk.white(meta.mode),
    chalk.gray('Workflow').padEnd(16) + ' │ ' + chalk.white(meta.workflowPattern || 'single-pass'),
    chalk.gray('Stack').padEnd(16) + ' │ ' + chalk.white(meta.stack),
    chalk.gray('Platforms').padEnd(16) + ' │ ' + chalk.white(meta.platforms?.join(', ') || 'general'),
    chalk.gray('Complexity').padEnd(16) + ' │ ' + chalk.yellow(meta.complexity),
    chalk.gray('Context Size').padEnd(16) + ' │ ' + chalk.yellow(meta.contextSize),
    chalk.gray('Context Diet').padEnd(16) + ' │ ' + (meta.contextDiet
      ? (meta.contextDiet.grade === 'heavy' ? chalk.red : meta.contextDiet.grade === 'ok' ? chalk.yellow : chalk.green)(`${meta.contextDiet.grade.toUpperCase()} (~${meta.contextDiet.estTokens}t)`)
      : chalk.gray('n/a')),
    chalk.gray('Quality Rubric').padEnd(16) + ' │ ' + (meta.qualityRubric
      ? (meta.qualityRubric.covered === meta.qualityRubric.total ? chalk.green : chalk.yellow)(`${meta.qualityRubric.covered}/${meta.qualityRubric.total} dims${meta.qualityRubric.weakest ? ` (fill ${meta.qualityRubric.weakest})` : ''}`)
      : chalk.gray('n/a')),
    chalk.gray('Scaffold').padEnd(16) + ' │ ' + scoreColor(`${validation.score}/100`),
    chalk.gray('Solution').padEnd(16) + ' │ ' + (validation.solutionReadiness === 'ready'
      ? chalk.green('READY')
      : chalk.yellow(`${(validation.solutionReadiness || 'draft').toUpperCase()} — fill PROBLEM ANALYSIS from the code`)),
    chalk.gray('Plan').padEnd(16) + ' │ ' + (validation.planReadiness === 'ready'
      ? chalk.green('READY')
      : chalk.yellow(`${(validation.planReadiness || 'draft').toUpperCase()} — fill TASK PLAN file:line + acceptance`)),
    chalk.gray('Agents').padEnd(16) + ' │ ' + chalk.white(meta.agents),
    chalk.gray('Read-only').padEnd(16) + ' │ ' + chalk.white(meta.readOnly ? 'Yes' : 'No'),
    chalk.gray('Stack Profile').padEnd(16) + ' │ ' + chalk.white(meta.stackProfile ? `${meta.stackProfile.status}: ${meta.stackProfile.path}` : 'Disabled'),
    chalk.gray('Task').padEnd(16) + ' │ ' + chalk.white(meta.task.substring(0, 34)),
  ];
  box('Metadata Card', lines, 'gray');
}

function parseArgs(args) {
  const flags = {
    mode: null,
    platform: null,
    template: null,
    stack: null,
    compact: false,
    full: false,
    json: false,
    save: null,
    saveDraft: null,
    printSkillsOnly: false,
    search: null,
    validate: null,
    listModes: false,
    listStacks: false,
    backend: false,
    database: null,
    initStackProfile: false,
    refreshStackProfile: false,
    noStackCache: false,
    sessionId: null,
    listSessions: false,
    model: null,
    help: false,
    maxTokens: 6000,
    contextReport: false,
    profile: null,
    discover: false,
    noDiscover: false,
    refreshSkills: false,
    dismissSkill: null,
    trustDetails: null,
    stats: false,
    recordOutcome: null,
    feedbackReport: false,
  };

  const taskWords = [];
  const takeValue = (name, index) => {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { flags.help = true; }
    else if (arg === '--mode') { flags.mode = takeValue(arg, i); i++; }
    else if (arg === '--platform') { flags.platform = takeValue(arg, i); i++; }
    else if (arg === '--template') { flags.template = takeValue(arg, i); i++; }
    else if (arg === '--stack') { flags.stack = takeValue(arg, i); i++; }
    else if (arg === '--compact') { flags.compact = true; }
    else if (arg === '--full') { flags.full = true; }
    else if (arg === '--json') { flags.json = true; }
    else if (arg === '--save') { flags.save = takeValue(arg, i); i++; }
    else if (arg === '--save-draft') { flags.saveDraft = takeValue(arg, i); i++; }
    else if (arg === '--print-skills-only') { flags.printSkillsOnly = true; }
    else if (arg === '--search') { flags.search = takeValue(arg, i); i++; }
    else if (arg === '--validate') { flags.validate = takeValue(arg, i); i++; }
    else if (arg === '--list-modes') { flags.listModes = true; }
    else if (arg === '--list-stacks') { flags.listStacks = true; }
    else if (arg === '--backend') { flags.backend = true; }
    else if (arg === '--database') { flags.database = takeValue(arg, i); i++; }
    else if (arg === '--init-stack-profile') { flags.initStackProfile = true; }
    else if (arg === '--refresh-stack-profile') { flags.refreshStackProfile = true; }
    else if (arg === '--no-stack-cache') { flags.noStackCache = true; }
    else if (arg === '--model') { flags.model = takeValue(arg, i); i++; }
    else if (arg === '--session-id') { flags.sessionId = takeValue(arg, i); i++; }
    else if (arg === '--list-sessions') { flags.listSessions = true; }
    else if (arg === '--max-tokens') { flags.maxTokens = Number(takeValue(arg, i)); i++; }
    else if (arg === '--context-report') { flags.contextReport = true; }
    else if (arg === '--profile') { flags.profile = takeValue(arg, i); i++; }
    else if (arg === '--discover') { flags.discover = true; }
    else if (arg === '--no-discover') { flags.noDiscover = true; }
    else if (arg === '--refresh-skills') { flags.refreshSkills = true; }
    else if (arg === '--dismiss-skill') { flags.dismissSkill = takeValue(arg, i); i++; }
    else if (arg === '--trust-details') { flags.trustDetails = takeValue(arg, i); i++; }
    else if (arg === '--stats') { flags.stats = true; }
    else if (arg === '--feedback-report') { flags.feedbackReport = true; }
    else if (arg === '--record-outcome') {
      const sessionId = takeValue(arg, i);
      const outcome = args[i + 2];
      if (!outcome || outcome.startsWith('--')) throw new Error('--record-outcome requires <session-id> <success|partial|fail>');
      let note = '';
      if (args[i + 3] && !args[i + 3].startsWith('--')) {
        note = args[i + 3];
        i++;
      }
      flags.recordOutcome = { sessionId, outcome, note };
      i += 2;
    }
    else if (arg.startsWith('--')) { throw new Error(`Unknown option: ${arg}`); }
    else {
      taskWords.push(arg);
    }
  }

  if (!Number.isInteger(flags.maxTokens) || flags.maxTokens <= 0) {
    throw new Error('--max-tokens must be a positive integer');
  }
  if (flags.model && !['haiku', 'sonnet', 'opus'].includes(flags.model)) {
    throw new Error('--model must be one of: haiku, sonnet, opus');
  }
  if (flags.mode && !listModes().some(mode => mode.key === flags.mode)) {
    throw new Error(`Unknown mode: ${flags.mode}`);
  }
  if (flags.save && flags.saveDraft) throw new Error('--save and --save-draft are mutually exclusive');
  return { flags, task: taskWords.join(' ') };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  let parsed;
  try {
    parsed = parseArgs(rawArgs);
  } catch (error) {
    console.error(chalk.red(`  ✖ Error: ${error.message}`));
    process.exit(1);
  }
  const { flags, task } = parsed;

  if (flags.help || rawArgs.length === 0) {
    showHelp();
    process.exit(0);
  }

  // Flag validation: discovery on/off are mutually exclusive.
  if (flags.discover && flags.noDiscover) {
    console.error(chalk.red('  ✖ Error: --discover and --no-discover are mutually exclusive'));
    process.exit(1);
  }

  const projectConfig = require('../src/project-config');
  const cwd = process.cwd();

  // --dismiss-skill: record the dismissal so it is never suggested again, then either exit
  // (if no task) or continue generating with it suppressed.
  if (flags.dismissSkill) {
    projectConfig.dismissSkill(cwd, flags.dismissSkill);
    console.log(`  ${chalk.green('✓')} Dismissed skill ${chalk.cyan(flags.dismissSkill)} — it will no longer be suggested for this project.`);
    if (!task) process.exit(0);
  }

  // Search mode
  if (flags.search !== null) {
    const results = searchData(flags.search);
    console.log(`\n  ${chalk.bold.white('🔍 Search Results')} ${chalk.gray(`for "${flags.search}"`)}`);
    console.log(`  ${chalk.gray(`Found ${results.length} matches`)}\n`);
    for (const r of results) {
      console.log(`  ${chalk.cyan('•')} [${chalk.yellow(r.file)}] ${chalk.white(r.line)}`);
    }
    console.log('');
    process.exit(0);
  }

  // Validate mode
  if (flags.validate !== null) {
    if (!flags.validate || !fs.existsSync(flags.validate)) {
      console.error(chalk.red('  ✖ Error: Provide a valid file path'));
      process.exit(1);
    }
    const prompt = fs.readFileSync(flags.validate, 'utf-8');
    const result = validatePrompt(prompt);
    const scoreColor = result.score >= 80 ? chalk.green : result.score >= 50 ? chalk.yellow : chalk.red;
    console.log(`\n  ${chalk.bold.white('🛡️  Validation Report')}\n`);
    console.log(`  ${chalk.bold('Score:')} ${scoreColor(`${result.score}/100`)} (${result.passed}/${result.total} checks)\n`);
    for (const c of result.checks) {
      console.log(`  ${c.pass ? chalk.green('✅') : chalk.red('❌')} ${c.label}`);
    }
    console.log('');
    process.exit(0);
  }

  // List modes
  if (flags.listModes) {
    console.log(`\n  ${chalk.bold.white('🎨 Available Modes')}\n`);
    const modes = listModes();
    for (const m of modes) {
      console.log(`  ${chalk.cyan('•')} ${chalk.yellow(m.key.padEnd(18))} ${chalk.gray(m.label)}`);
    }
    console.log('');
    process.exit(0);
  }

  // List sessions
  if (flags.listSessions) {
    console.log(`\n  ${chalk.bold.white('🗄  Recent Sessions')}\n`);
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log(`  ${chalk.gray('No sessions found.')}`);
    } else {
      for (const s of sessions) {
        const date = new Date(s.updated_at).toLocaleString();
        console.log(`  ${chalk.cyan('•')} ${chalk.yellow(s.id)}  ${chalk.white(s.task.substring(0, 40))}  ${chalk.gray(date)}`);
      }
    }
    console.log('');
    process.exit(0);
  }

  // List stacks
  if (flags.listStacks) {
    console.log(`\n  ${chalk.bold.white('🏗️  Available Stacks')}\n`);
    const stacks = [
      ['nextjs', 'Next.js App Router + TypeScript + MUI/shadcn'],
      ['spring-boot', 'Spring Boot 3 + Gradle + PostgreSQL'],
      ['ios-swift', 'iOS / Swift / SwiftUI / Xcode'],
      ['android-kotlin', 'Android / Kotlin / Compose / Gradle'],
      ['flutter', 'Flutter / Dart'],
      ['react-native', 'React Native / Expo'],
      ['desktop', 'Electron / Tauri / native desktop'],
      ['cli', 'CLI / developer tooling'],
      ['ai-app', 'AI / LLM / RAG / agent app'],
      ['devops', 'DevOps / deployment / CI-CD'],
      ['laravel', 'Laravel / PHP'],
      ['python', 'Python / FastAPI / Django / Flask'],
      ['go', 'Go / Gin / Echo / Fiber'],
      ['rust', 'Rust / Actix / Tokio / Axum'],
      ['dotnet', '.NET / C# / ASP.NET / Blazor'],
      ['unity', 'Unity / Game Dev'],
      ['data-ml', 'Data / ML Pipeline'],
      ['db', 'Database / PostgreSQL / Mongo / Redis'],
      ['general', 'Unknown or mixed software project']
    ];
    for (const [name, desc] of stacks) {
      console.log(`  ${chalk.cyan('•')} ${chalk.yellow(name.padEnd(14))} ${chalk.gray(desc)}`);
    }
    console.log('');
    process.exit(0);
  }

  if (flags.trustDetails) {
    const path = require('path');
    const { scanInstalledSkills } = require('../src/stack-cache');
    const { assessSkillTrust, renderTrustDetails } = require('../src/skill-trust');
    const norm = value => String(value || '').toLowerCase().replace(/^.*[:/]/, '').replace(/[^a-z0-9]+/g, '');
    const installed = scanInstalledSkills({ cwd });
    let skill = installed.find(item => norm(item.name) === norm(flags.trustDetails));
    if (!skill) {
      const cachePath = path.join(cwd, '.prompt-builder', 'skill-discovery.json');
      try {
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const candidate = (cache.result && cache.result.available || []).find(item => norm(item.name) === norm(flags.trustDetails));
        if (candidate) skill = candidate;
      } catch (_) { /* no cached ecosystem metadata */ }
    }
    if (!skill) {
      console.error(chalk.red(`  ✖ Skill not found locally or in cached discovery metadata: ${flags.trustDetails}`));
      process.exit(1);
    }
    const trust = assessSkillTrust(skill);
    const output = { skill: skill.name, ...trust, findings: renderTrustDetails(trust) };
    if (flags.json) console.log(JSON.stringify(output, null, 2));
    else {
      console.log(`\n  ${chalk.bold('Skill Trust Details')}: ${chalk.cyan(skill.name)}`);
      console.log(`  Risk: ${output.risk} | Screened: ${output.screened}`);
      if (!output.findings.length) console.log('  No static findings. This is not a security guarantee.');
      for (const finding of output.findings) {
        console.log(`  • [${finding.severity}] ${finding.pattern} at ${finding.where}`);
        console.log(`    ${finding.excerpt}`);
      }
      console.log('');
    }
    process.exit(0);
  }

  if (flags.stats) {
    const stats = buildStats(sessionStore);
    if (flags.json) console.log(JSON.stringify(stats, null, 2));
    else {
      console.log(`\n  ${chalk.bold('Session Statistics')}`);
      console.log(`  Sessions: ${stats.sessions} | Generations: ${stats.generations}`);
      console.log(`  Average validation: ${stats.averageValidationScore}`);
      console.log(`  Average estimated tokens: ${stats.averageEstimatedPromptTokens}`);
      console.log(`  Modes: ${JSON.stringify(stats.perMode)}`);
      console.log(`  Outcomes: ${JSON.stringify(stats.outcomes)}\n`);
    }
    process.exit(0);
  }

  if (flags.recordOutcome) {
    const { sessionId, outcome, note } = flags.recordOutcome;
    const session = recordOutcome(sessionId, outcome, note);
    const output = { sessionId, outcome: session.outcome, updatedAt: session.updated_at };
    if (flags.json) console.log(JSON.stringify(output, null, 2));
    else console.log(`  ${chalk.green('✓')} Outcome recorded: ${sessionId} → ${session.outcome}`);
    process.exit(0);
  }

  if (flags.feedbackReport) {
    const report = buildFeedbackReport(sessionStore);
    if (flags.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`\n  ${chalk.bold('Feedback Report')}`);
      console.log(`  Samples: ${JSON.stringify(report.sampleCounts)}`);
      console.log(`  Failure correlations: ${JSON.stringify(report.failureCorrelations)}`);
      console.log(`  Regenerations within ${report.regenerationWindowMinutes}m: ${report.regenerations.length}`);
      console.log('  Template sections to revisit:');
      for (const item of report.sectionsToRevisit) console.log(`  • ${item.section}: ${item.signals} signal(s)`);
      console.log(`  ${report.note}\n`);
    }
    process.exit(0);
  }

  let effectiveTask = task;
  if (!effectiveTask && flags.initStackProfile && (flags.stack || flags.database || flags.platform)) {
    effectiveTask = `initialize ${flags.stack || flags.database || flags.platform} stack profile`;
  }

  if (!effectiveTask && !flags.sessionId) {
    console.error(chalk.red('  ✖ Error: Provide a task description'));
    process.exit(1);
  }

  // Resume or create session
  let sessionId = null;
  if (flags.sessionId) {
    const resumed = resumeSession(flags.sessionId);
    if (resumed) {
      sessionId = flags.sessionId;
      if (!effectiveTask && resumed.lastTurn) {
        try {
          const last = JSON.parse(resumed.lastTurn.output || '{}');
          effectiveTask = resumed.session.task || 'continued session';
        } catch (e) {
          effectiveTask = resumed.session.task || 'continued session';
        }
      }
    } else {
      // Session will be created with the requested id during persist
      sessionId = flags.sessionId;
    }
  }

  if (flags.backend) effectiveTask += ' backend';
  if (flags.database) effectiveTask += ` ${flags.database} database`;

  // ── Skill discovery decision (A2) ──────────────────────────────────────────────────────────
  // Network is only hit when the user opted in (--discover, or a stored project preference).
  // Default first run: no network, print a one-line hint. Discovery degrades gracefully on failure.
  const cfg = projectConfig.readConfig(cwd);
  if (flags.discover && !cfg.discoverEnabled) projectConfig.setDiscoverEnabled(cwd, true);
  const wantDiscover = !flags.noDiscover && (flags.discover || cfg.discoverEnabled);

  let discovery = null;
  if (wantDiscover) {
    try {
      const { detectStack, detectPlatformsMixed, analyzeTask, getSkillSearchQueries, discoverSkills } = require('../src/index');
      const dStack = flags.stack || detectStack(effectiveTask);
      const dPlatforms = detectPlatformsMixed(effectiveTask);
      const dDomains = analyzeTask(effectiveTask).domains;
      const queries = getSkillSearchQueries(effectiveTask, dDomains, dPlatforms, dStack);
      discovery = await discoverSkills(queries, { cwd, refresh: flags.refreshSkills });
    } catch (e) {
      discovery = { status: 'unavailable', reason: `discovery error: ${e.message}`, installed: [], available: [], unavailable: [], fromCache: false };
    }
  } else if (!flags.noDiscover && !cfg.discoverEnabled) {
    console.log(`  ${chalk.gray('Tip: run with --discover to check the skills ecosystem for better-fitting skills.')}`);
  }

  const options = {
    mode: flags.mode,
    template: flags.template,
    stack: flags.stack || flags.database,
    platform: flags.platform,
    stackProfile: !flags.noStackCache,
    refreshStackProfile: flags.refreshStackProfile || flags.initStackProfile,
    model: flags.model,
    cwd: process.cwd(),
    maxTokens: flags.maxTokens,
    full: flags.full,
    contextReport: flags.contextReport,
    profile: flags.profile,
    discovery,
    dismissedSkills: cfg.dismissedSkills,
  };

  const result = generatePrompt(effectiveTask, options);

  // Persist session best-effort. Prompt generation must not fail because local
  // history storage is unavailable in a sandbox or read-only environment.
  let sessionPersisted = false;
  try {
    if (!sessionId || !resumeSession(sessionId)) {
      sessionId = createSession(
        effectiveTask,
        result.metadata.mode,
        result.metadata.stack,
        sessionId || undefined,
        { template: result.metadata.template }
      );
    }
    const sectionNames = [
      'SYSTEM CONTRACT', 'WORKFLOW PATTERN', 'QUALITY BAR', 'GROUNDED TARGETS',
      'EXPLORATION CONTRACT', 'GROUNDING CONTRACT', 'PROBLEM ANALYSIS',
      'WRITE SAFETY GATE', 'SKILL DISCOVERY PREFLIGHT', 'SKILL REVIEW RUBRIC',
      'MATCHED SKILLS', 'SKILL SUGGESTIONS', 'MULTI-AGENT TASK BOARD',
      'AGENT REVIEW COUNCIL', 'TASK PLAN', 'VERIFICATION CONTRACT',
    ].filter(name => result.prompt.includes(name));
    saveTurn(sessionId, effectiveTask, result.prompt, result.validation.score, {
      estimatedTokens: result.metadata.contextDiet.estTokens,
      mode: result.metadata.mode,
      stack: result.metadata.stack,
      template: result.metadata.template,
      skillSuggestions: result.metadata.skillSuggestions.map(item => item.name),
      sections: sectionNames,
    });
    sessionPersisted = true;
  } catch (error) {
    if (flags.sessionId || flags.listSessions) {
      const categorized = categorizeError(error);
      console.error(chalk.yellow(`  ⚠ Session persistence unavailable (${categorized.category}): ${categorized.description}`));
    }
    sessionId = sessionId || 'not-persisted';
  }

  if (flags.initStackProfile) {
    const profile = result.metadata.stackProfile;
    console.log(`\n  ${chalk.green('✓')} Stack profile ${profile.status}: ${chalk.cyan(profile.path)}`);
    console.log(`  ${chalk.gray(`Stack: ${result.metadata.stack} | Platforms: ${result.metadata.platforms?.join(', ') || 'general'}`)}`);
    console.log(`  ${chalk.gray('Missing skills are written to the MD as approval-required install commands.')}\n`);
    process.exit(0);
  }

  // --print-skills-only
  if (flags.printSkillsOnly) {
    console.log(`\n  ${chalk.bold.white('🎯 Matched Skills')}\n`);
    for (const d of result.metadata.domains) {
      console.log(`  ${chalk.cyan('•')} ${chalk.white(d)}`);
    }
    console.log(`\n  ${chalk.gray(`Platforms: ${result.metadata.platforms?.join(', ') || 'general'}`)}`);
    console.log(`  ${chalk.gray(`Mode: ${result.metadata.mode}`)}`);
    console.log('');
    process.exit(0);
  }

  // --json
  if (flags.json) {
    console.log(JSON.stringify({
      prompt: result.prompt,
      metadata: result.metadata,
      validation: result.validation,
      skillSuggestions: result.metadata.skillSuggestions || [],
      excludedSkillSuggestions: result.metadata.excludedSkillSuggestions || [],
      discovery: result.metadata.discovery || null,
    }, null, 2));
    process.exit(0);
  }

  // --save / --save-draft
  if (flags.save || flags.saveDraft) {
    if (flags.save && result.validation.readiness !== 'ready') {
      console.error(chalk.red('  ✖ DRAFT: refusing --save because unresolved markers remain.'));
      for (const marker of result.validation.blockingMarkers.slice(0, 12)) {
        console.error(`    line ${marker.line} [${marker.section}] ${marker.marker}`);
      }
      console.error(chalk.gray('  Use --save-draft <file> only when you intentionally want the unresolved scaffold.'));
      process.exit(1);
    }
    const savePath = flags.save || flags.saveDraft;
    fs.writeFileSync(savePath, result.prompt, 'utf-8');
    console.log(`  ${chalk.green('✓')} ${flags.saveDraft ? 'Draft prompt' : 'Prompt'} saved to ${chalk.cyan(savePath)}`);
    console.log(`  ${chalk.gray(`Mode: ${result.metadata.mode} | Platforms: ${result.metadata.platforms?.join(', ') || 'general'} | Scaffold: ${result.validation.score}/100 | Solution: ${(result.validation.solutionReadiness || 'draft').toUpperCase()} | Plan: ${(result.validation.planReadiness || 'draft').toUpperCase()}`)}`);
    if ((result.validation.readiness || 'draft') !== 'ready') {
      console.log(`  ${chalk.yellow('→ DRAFT:')} ${chalk.gray('read the resolved targets, fill PROBLEM ANALYSIS (root cause + fix) and TASK PLAN (file:line tasks + acceptance), then the prompt is ready.')}`);
    }
    if (result.metadata.stackProfile) {
      console.log(`  ${chalk.gray(`Stack profile: ${result.metadata.stackProfile.status} ${result.metadata.stackProfile.path}`)}`);
    }
    process.exit(0);
  }

  // --compact
  if (flags.compact) {
    console.log(result.prompt);
    process.exit(0);
  }

  // Full output (default)
  box('Generated Prompt', [
    chalk.gray('Universal Agent Orchestration Planner'),
    chalk.gray(`Mode: ${result.metadata.mode} | Platforms: ${result.metadata.platforms?.join(', ') || 'general'}`),
    chalk.gray(`Stack profile: ${result.metadata.stackProfile ? `${result.metadata.stackProfile.status} ${result.metadata.stackProfile.path}` : 'disabled'}`),
    chalk.gray(`Session: ${sessionPersisted ? sessionId : 'not persisted'}`),
  ], 'green');

  // Skill suggestions box (A4): show "you could do this better with skill X" BEFORE the prompt body.
  const suggestions = result.metadata.skillSuggestions || [];
  if (suggestions.length) {
    const lines = [chalk.gray('Not installed — install only after you approve:')];
    for (const s of suggestions) {
      lines.push(`${chalk.cyan('•')} ${chalk.bold.white(s.name)} ${chalk.gray(`(${s.source})`)}`);
      lines.push(`  ${chalk.gray(s.fits)}`);
      lines.push(`  ${chalk.gray(s.trustNote)}`);
      lines.push(`  ${chalk.green(s.install)}  ${chalk.gray('then /reload-skills + rerun')}`);
    }
    lines.push(chalk.gray('Dismiss one with: --dismiss-skill <name>'));
    box('⤓ Skill Suggestions — approval required', lines, 'cyan');
  } else if (result.metadata.discovery && result.metadata.discovery.status === 'unavailable') {
    console.log(`  ${chalk.yellow('⚠')} ${chalk.gray(`Skill discovery unavailable (${result.metadata.discovery.reason}) — using static matches.`)}`);
  }

  // Extract TASK PLAN rows for execution-plan display. The assembler emits spec-kit-style
  // rows (`  [ ] T001 ...` for edit tasks, `  [ ] F001 ...` for findings ledgers), so match
  // those instead of the obsolete `Sub-tasks:`/`- [ ]` shape.
  const taskNames = [];
  for (const line of result.prompt.split('\n')) {
    const m = line.match(/^\s*\[ \]\s+([TF]\d{2,3}\b.*)$/);
    if (m) taskNames.push(m[1].trim());
  }
  if (taskNames.length > 0) {
    printTaskList(taskNames, 0);
  }

  console.log('');
  hr('green');
  console.log(chalk.white(result.prompt));
  hr('green');

  printMetadataCard(result.metadata, result.validation);

  if (flags.contextReport) {
    const { getContextReport } = require('../src/context-manager');
    const report = getContextReport();
    if (report) {
      console.log('');
      hr('cyan');
      console.log(`  ${chalk.bold.white('📊 Context Report')}`);
      hr('cyan');
      console.log(`  ${chalk.gray('Total:')} ${chalk.white(report.totalTokens)} ${chalk.gray('tokens')} ${chalk.gray('| Budget:')} ${chalk.white(flags.maxTokens || 'unlimited')}`);
      for (const s of report.sections) {
        const color = s.action === 'keep' ? chalk.green : s.action === 'compress' ? chalk.yellow : chalk.red;
        console.log(`  ${color(s.action.padEnd(8))} ${chalk.gray(s.name.padEnd(34))} ${chalk.white(String(s.used).padStart(4))} / ${chalk.white(String(s.allocated).padStart(4))}`);
      }
      hr('cyan');
    }
  }

  console.log('');
  hr('gray');
  console.log(`  ${chalk.gray('Session ID:')} ${chalk.cyan(sessionPersisted ? sessionId : 'not persisted')}`);
  hr('gray');
}

main().catch((e) => {
  console.error(chalk.red(`  ✖ ${e && e.message ? e.message : e}`));
  process.exit(1);
});
