#!/usr/bin/env node
const { generatePrompt, searchData, validatePrompt, listModes, detectPlatformsMixed } = require('../src/index');
const fs = require('fs');
const chalk = require('chalk');

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
  box('prompt-builder v1.4.1', [
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
  ${chalk.green('prompt-builder')} ${chalk.cyan('--print-skills-only')} "${chalk.yellow('<task>')}"                 ${chalk.gray('# Output matched skills')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--stack')} <stack> "${chalk.yellow('<task>')}"                       ${chalk.gray('# Override stack detection')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--backend')} "${chalk.yellow('<task>')}"                             ${chalk.gray('# Force backend context')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--database')} <db> "${chalk.yellow('<task>')}"                       ${chalk.gray('# Force database context')}

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
    chalk.gray('Stack').padEnd(16) + ' │ ' + chalk.white(meta.stack),
    chalk.gray('Platforms').padEnd(16) + ' │ ' + chalk.white(meta.platforms?.join(', ') || 'general'),
    chalk.gray('Complexity').padEnd(16) + ' │ ' + chalk.yellow(meta.complexity),
    chalk.gray('Context Size').padEnd(16) + ' │ ' + chalk.yellow(meta.contextSize),
    chalk.gray('Validation').padEnd(16) + ' │ ' + scoreColor(`${validation.score}/100`),
    chalk.gray('Agents').padEnd(16) + ' │ ' + chalk.white(meta.agents),
    chalk.gray('Read-only').padEnd(16) + ' │ ' + chalk.white(meta.readOnly ? 'Yes' : 'No'),
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
    noSkillSearch: false,
    printSkillsOnly: false,
    search: null,
    validate: null,
    listModes: false,
    listStacks: false,
    backend: false,
    database: null,
    help: false,
  };

  const taskWords = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { flags.help = true; }
    else if (arg === '--mode') { flags.mode = args[++i]; }
    else if (arg === '--platform') { flags.platform = args[++i]; }
    else if (arg === '--template') { flags.template = args[++i]; }
    else if (arg === '--stack') { flags.stack = args[++i]; }
    else if (arg === '--compact') { flags.compact = true; }
    else if (arg === '--full') { flags.full = true; }
    else if (arg === '--json') { flags.json = true; }
    else if (arg === '--save') { flags.save = args[++i]; }
    else if (arg === '--no-skill-search') { flags.noSkillSearch = true; }
    else if (arg === '--print-skills-only') { flags.printSkillsOnly = true; }
    else if (arg === '--search') { flags.search = args[++i]; }
    else if (arg === '--validate') { flags.validate = args[++i]; }
    else if (arg === '--list-modes') { flags.listModes = true; }
    else if (arg === '--list-stacks') { flags.listStacks = true; }
    else if (arg === '--backend') { flags.backend = true; }
    else if (arg === '--database') { flags.database = args[++i]; }
    else {
      taskWords.push(arg);
    }
  }

  return { flags, task: taskWords.join(' ') };
}

function main() {
  const rawArgs = process.argv.slice(2);
  const { flags, task } = parseArgs(rawArgs);

  if (flags.help || rawArgs.length === 0) {
    showHelp();
    process.exit(0);
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

  if (!task) {
    console.error(chalk.red('  ✖ Error: Provide a task description'));
    process.exit(1);
  }

  let effectiveTask = task;
  if (flags.backend) effectiveTask += ' backend';
  if (flags.database) effectiveTask += ` ${flags.database} database`;

  const options = {
    mode: flags.mode,
    template: flags.template,
    stack: flags.stack || flags.database,
  };

  const result = generatePrompt(effectiveTask, options);

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
    }, null, 2));
    process.exit(0);
  }

  // --save
  if (flags.save) {
    fs.writeFileSync(flags.save, result.prompt, 'utf-8');
    console.log(`  ${chalk.green('✓')} Prompt saved to ${chalk.cyan(flags.save)}`);
    console.log(`  ${chalk.gray(`Mode: ${result.metadata.mode} | Platforms: ${result.metadata.platforms?.join(', ') || 'general'} | Validation: ${result.validation.score}/100`)}`);
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
  ], 'green');

  // Extract sub-tasks for execution plan display
  const promptLines = result.prompt.split('\n');
  let inSubTasks = false;
  const taskNames = [];
  for (const line of promptLines) {
    if (line.trim() === 'Sub-tasks:') { inSubTasks = true; continue; }
    if (line.trim() === '') { inSubTasks = false; continue; }
    if (inSubTasks && line.trim().startsWith('- [ ]')) {
      taskNames.push(line.replace('- [ ]', '').trim());
    }
  }
  if (taskNames.length > 0) {
    printTaskList(taskNames, 0);
  }

  console.log('');
  hr('green');
  console.log(chalk.white(result.prompt));
  hr('green');

  printMetadataCard(result.metadata, result.validation);
}

main();
