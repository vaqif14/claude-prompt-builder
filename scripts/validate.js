#!/usr/bin/env node
const fs = require('fs');

/**
 * Validation V2 — Quality scoring for generated prompts
 * Replaces trivial presence checks with meaningful quality gates.
 */

function validatePrompt(promptText) {
  const p = promptText;
  const checks = [];

  // 1. Skill Discovery (15 pts)
  const hasSkillDiscovery = /Skill Discovery Preflight/i.test(p) &&
    /local scan|ecosystem scan|npx skills find/i.test(p);
  checks.push({ pass: hasSkillDiscovery, label: 'Skill discovery preflight present', points: 15 });

  // 2. Platform Detection (15 pts)
  const hasPlatform = /Detected Platform|Platform Profile/i.test(p) &&
    /signals|default skills|evidence/i.test(p);
  checks.push({ pass: hasPlatform, label: 'Platform correctly detected with evidence', points: 15 });

  // 3. Agent Roster / Task Board (15 pts)
  const hasAgentBoard = /Multica-Style Task Board|Agent Assignment|task card|owner/i.test(p) &&
    /id \||owner \||title \||depends_on/i.test(p);
  checks.push({ pass: hasAgentBoard, label: 'Agent roster or task board present', points: 15 });

  // 4. Evidence Gates (15 pts)
  const hasEvidence = /Evidence Gates|evidence required|screenshot|console|network|log/i.test(p);
  checks.push({ pass: hasEvidence, label: 'Evidence gates defined', points: 15 });

  // 5. Stop Conditions (10 pts)
  const hasStopConditions = /Stop Conditions|Stop and Ask|escalate/i.test(p);
  checks.push({ pass: hasStopConditions, label: 'Stop conditions present', points: 10 });

  // 6. Output Schema Actionable (10 pts)
  const hasOutputSchema = /Output Schema|Output Format/i.test(p) &&
    /file:line|verdict|screenshot|changelog|test/i.test(p);
  checks.push({ pass: hasOutputSchema, label: 'Output schema is actionable', points: 10 });

  // 7. Not Generic (10 pts)
  const hasPlaceholder = /\[stack\]|\[platform\]|\[skill\]/i.test(p);
  const hasVagueTasks = /Analyze existing implementations|Implement solution|Add validation/i.test(p) &&
    !/file:line|route|component|hook|api/i.test(p);
  checks.push({
    pass: !hasPlaceholder && !hasVagueTasks,
    label: 'Not generic (no placeholders, no vague sub-tasks)',
    points: 10,
  });

  // 8. Prompt Length (10 pts)
  const lengthOk = p.length > 800 && p.length < 20000;
  checks.push({ pass: lengthOk, label: 'Prompt length appropriate (800-20k chars)', points: 10 });

  const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
  const earnedPoints = checks.reduce((sum, c) => sum + (c.pass ? c.points : 0), 0);
  const score = Math.round((earnedPoints / totalPoints) * 100);

  let grade = 'fail';
  if (score >= 80) grade = 'pass';
  else if (score >= 60) grade = 'warn';

  return {
    checks,
    passed: checks.filter(c => c.pass).length,
    total: checks.length,
    score,
    grade,
    earnedPoints,
    totalPoints,
  };
}

function formatReport(result) {
  const gradeColor = result.grade === 'pass' ? '\x1b[32m' : result.grade === 'warn' ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  let out = `\n  ${bold}🛡️  Validation Report V2${reset}\n`;
  out += `  ${bold}Score:${reset} ${gradeColor}${result.score}/100${reset} (${result.earnedPoints}/${result.totalPoints} pts)\n`;
  out += `  ${bold}Grade:${reset} ${gradeColor}${result.grade.toUpperCase()}${reset}\n\n`;

  for (const c of result.checks) {
    const icon = c.pass ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
    out += `  ${icon} ${c.label} ${bold}(${c.points} pts)${reset}\n`;
  }
  out += '\n';
  return out;
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.log('Usage: validate.js <prompt-file.txt>');
    process.exit(1);
  }
  const prompt = fs.readFileSync(file, 'utf-8');
  const result = validatePrompt(prompt);
  console.log(formatReport(result));
  process.exit(result.grade === 'pass' ? 0 : 1);
}

module.exports = { validatePrompt, formatReport };
