#!/usr/bin/env node
const fs = require('fs');
const { PROMPT_INJECTION_MARKERS, DANGEROUS_BASH_PATTERNS } = require('../src/sanitize');

/**
 * Validation V2 — Quality scoring for generated prompts
 * Replaces trivial presence checks with meaningful quality gates.
 */

function validatePrompt(promptText) {
  const p = promptText;
  const checks = [];

  // 1. Skill Discovery (12 pts)
  const hasSkillDiscovery = /Skill Discovery Preflight/i.test(p) &&
    /local scan|ecosystem scan|npx skills find|stack profile cache|cached stack profile/i.test(p);
  const hasStackSpecificDiscovery = /npx skills find "[a-z -]+ best practices"/i.test(p) ||
    /npx skills find "[a-z -]+ security review"/i.test(p) ||
    /npx skills find "[a-z -]+ testing review"/i.test(p) ||
    /Stack profile cache:\s*(HIT|MISS|REFRESHED)/i.test(p);
  checks.push({ pass: hasSkillDiscovery, label: 'Skill discovery preflight present', points: 7 });
  checks.push({ pass: hasStackSpecificDiscovery, label: 'Stack-specific skill discovery queries', points: 5 });

  // 2. Platform Detection (12 pts)
  const hasPlatform = /Detected Platform|Platform Profile/i.test(p) &&
    /signals|default skills|evidence/i.test(p);
  checks.push({ pass: hasPlatform, label: 'Platform correctly detected with evidence', points: 12 });

  // 3. Agent Roster / Task Board (12 pts)
  const hasAgentBoard = /Multi-Agent Task Board|Multica-Style Task Board|Agent Assignment|task card|owner/i.test(p) &&
    /id \||owner \||title \||depends_on/i.test(p);
  checks.push({ pass: hasAgentBoard, label: 'Agent roster or task board present', points: 12 });

  // 3b. Skill invocation list + agent→skill binding actually survived budgeting (8 pts)
  const hasRequiredSkills = /Required Skills To Invoke/i.test(p);
  const hasSkillBinding = /skill=/.test(p) && /Skill Binding Rule/i.test(p);
  checks.push({ pass: hasRequiredSkills, label: 'Required-skills-to-invoke list present (not elided)', points: 4 });
  checks.push({ pass: hasSkillBinding, label: 'Each agent bound to a skill', points: 4 });

  // 4. Evidence Gates (12 pts)
  const hasEvidence = /Evidence Gates|evidence required|screenshot|console|network|log/i.test(p);
  checks.push({ pass: hasEvidence, label: 'Evidence gates defined', points: 12 });

  // 5. Stop Conditions (8 pts)
  const hasStopConditions = /Stop Conditions|Stop and Ask|escalate/i.test(p);
  checks.push({ pass: hasStopConditions, label: 'Stop conditions present', points: 8 });

  // 6. Output Schema Actionable (8 pts)
  const hasOutputSchema = /Output Schema|Output Format/i.test(p) &&
    /file:line|verdict|screenshot|changelog|test/i.test(p);
  checks.push({ pass: hasOutputSchema, label: 'Output schema is actionable', points: 8 });

  // 7. Not Generic (8 pts)
  const hasPlaceholder = /\[stack\]|\[platform\]|\[skill\]/i.test(p);
  const hasVagueTasks = /Analyze existing implementations|Implement solution|Add validation/i.test(p) &&
    !/file:line|route|component|hook|api/i.test(p);
  checks.push({
    pass: !hasPlaceholder && !hasVagueTasks,
    label: 'Not generic (no placeholders, no vague sub-tasks)',
    points: 8,
  });

  // 8. Prompt Length (8 pts)
  const tokens = Math.ceil(p.length / 4);
  const lengthOk = tokens > 200 && tokens < 6000;
  checks.push({ pass: lengthOk, label: 'Prompt within token budget', points: 8 });

  // 9. Stack Intelligence (v1.5.0) — 15 pts
  const hasStackProfile = /Stack:/i.test(p) && /Pattern:|DI:|Decorators:|Commands:|Runtime:/i.test(p);
  const hasBestPractices = /STACK BEST PRACTICES/i.test(p) || /Best Practice|best-practice/i.test(p);
  const hasAntiPatterns = /ANTI-PATTERNS/i.test(p) || /anti-pattern|AntiPattern|avoid/i.test(p);
  const hasVerificationGates = /VERIFICATION GATES/i.test(p) || /verification|Verification Gate/i.test(p);
  checks.push({ pass: hasStackProfile, label: 'Stack profile present with pattern/convention data', points: 4 });
  checks.push({ pass: hasBestPractices, label: 'Stack best practices section present', points: 4 });
  checks.push({ pass: hasAntiPatterns, label: 'Anti-patterns section present', points: 4 });
  checks.push({ pass: hasVerificationGates, label: 'Verification gates section present', points: 3 });

  // 10. Security Gate (v1.5.1) — 5 pts
  const hasInjection = PROMPT_INJECTION_MARKERS.some(m => m.test(p));
  const hasDangerousBash = DANGEROUS_BASH_PATTERNS.some(m => m.test(p));
  checks.push({
    pass: !hasInjection && !hasDangerousBash,
    label: 'No prompt injection or dangerous patterns',
    points: 5,
  });

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
