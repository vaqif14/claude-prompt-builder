#!/usr/bin/env node
const { generatePrompt, searchData, validatePrompt } = require('../src/index');
const fs = require('fs');
const chalk = require('chalk');

const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

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
  box('prompt-builder v1.0.0', [
    chalk.gray('Architect-grade prompt engineer for Claude Code'),
    '',
    chalk.white('Author:  ') + chalk.cyan('Vaqif Gulmammadov'),
    chalk.white('GitHub:  ') + chalk.cyan('github.com/vaqif14/claude-prompt-builder'),
  ], 'cyan');

  console.log(`
${chalk.bold('Usage:')}
  ${chalk.green('prompt-builder')} "${chalk.yellow('<task description>')}"                    ${chalk.gray('# Generate prompt')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--template')} <type> ${chalk.cyan('--stack')} <stack> "..."  ${chalk.gray('# Use specific template/stack')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--search')} <query>                         ${chalk.gray('# Search data catalog')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--validate')} <file>                        ${chalk.gray('# Validate prompt file')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--list-templates')}                         ${chalk.gray('# List available templates')}
  ${chalk.green('prompt-builder')} ${chalk.cyan('--list-stacks')}                            ${chalk.gray('# List available stacks')}

${chalk.bold('Templates:')} ${chalk.yellow('feature')}, ${chalk.yellow('refactor')}, ${chalk.yellow('bugfix')}, ${chalk.yellow('audit')}
${chalk.bold('Stacks:')}    ${chalk.yellow('spring-boot')}, ${chalk.yellow('nextjs')}

${chalk.bold('Examples:')}
  ${chalk.green('prompt-builder')} "${chalk.yellow('Add auction countdown timer')}"
  ${chalk.green('prompt-builder')} ${chalk.cyan('--template')} audit ${chalk.cyan('--stack')} spring-boot "${chalk.yellow('Check auth vulnerabilities')}"
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
    '─'.repeat(16) + '─┼─' + '─'.repeat(30),
    chalk.gray('Template').padEnd(16) + ' │ ' + chalk.white(meta.template),
    chalk.gray('Stack').padEnd(16) + ' │ ' + chalk.white(meta.stack),
    chalk.gray('Complexity').padEnd(16) + ' │ ' + chalk.yellow(meta.complexity),
    chalk.gray('Context Size').padEnd(16) + ' │ ' + chalk.yellow(meta.contextSize),
    chalk.gray('Validation').padEnd(16) + ' │ ' + scoreColor(`${validation.score}/100`),
    chalk.gray('Task').padEnd(16) + ' │ ' + chalk.white(meta.task.substring(0, 30)),
  ];
  box('Metadata Card', lines, 'gray');
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Search mode
  const searchIdx = args.indexOf('--search');
  if (searchIdx !== -1) {
    const query = args[searchIdx + 1] || '';
    const results = searchData(query);
    console.log(`\n  ${chalk.bold.white('🔍 Search Results')} ${chalk.gray(`for "${query}"`)}`);
    console.log(`  ${chalk.gray(`Found ${results.length} matches`)}\n`);
    for (const r of results) {
      console.log(`  ${chalk.cyan('•')} [${chalk.yellow(r.file)}] ${chalk.white(r.line)}`);
    }
    console.log('');
    process.exit(0);
  }

  // Validate mode
  const validateIdx = args.indexOf('--validate');
  if (validateIdx !== -1) {
    const file = args[validateIdx + 1];
    if (!file || !fs.existsSync(file)) {
      console.error(chalk.red('  ✖ Error: Provide a valid file path'));
      process.exit(1);
    }
    const prompt = fs.readFileSync(file, 'utf-8');
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

  // List templates
  if (args.includes('--list-templates')) {
    console.log(`\n  ${chalk.bold.white('📋 Available Templates')}\n`);
    const templates = [
      ['feature', 'New feature implementation'],
      ['refactor', 'Code modernization'],
      ['bugfix', 'Bug diagnosis and fix'],
      ['audit', 'Security/quality audit']
    ];
    for (const [name, desc] of templates) {
      console.log(`  ${chalk.cyan('•')} ${chalk.yellow(name.padEnd(10))} ${chalk.gray(desc)}`);
    }
    console.log('');
    process.exit(0);
  }

  // List stacks
  if (args.includes('--list-stacks')) {
    console.log(`\n  ${chalk.bold.white('🏗️  Available Stacks')}\n`);
    const stacks = [
      ['spring-boot', 'Spring Boot 3 + Gradle + PostgreSQL'],
      ['nextjs', 'Next.js 14 + TypeScript + shadcn/ui']
    ];
    for (const [name, desc] of stacks) {
      console.log(`  ${chalk.cyan('•')} ${chalk.yellow(name.padEnd(12))} ${chalk.gray(desc)}`);
    }
    console.log('');
    process.exit(0);
  }

  // Generate mode
  const templateIdx = args.indexOf('--template');
  const stackIdx = args.indexOf('--stack');
  const template = templateIdx !== -1 ? args[templateIdx + 1] : 'feature';
  const stack = stackIdx !== -1 ? args[stackIdx + 1] : 'nextjs';

  const taskArgs = args.filter((_, i) => {
    if (args[i] === '--template' || args[i] === '--stack') return false;
    if (args[i - 1] === '--template' || args[i - 1] === '--stack') return false;
    return true;
  });

  const task = taskArgs.join(' ');
  if (!task) {
    console.error(chalk.red('  ✖ Error: Provide a task description'));
    process.exit(1);
  }

  const result = generatePrompt(task, { template, stack });

  // Header
  box('Generated Prompt', [chalk.gray('Claude Code Architecture Certified')], 'green');

  // Task list
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

  // Prompt body
  console.log('');
  hr('green');
  console.log(chalk.white(result.prompt));
  hr('green');

  // Metadata
  printMetadataCard(result.metadata, result.validation);
}

main();
