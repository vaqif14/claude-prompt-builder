#!/usr/bin/env node
const fs = require('fs');

function validatePrompt(promptText) {
  const checks = [];
  const p = promptText;
  
  checks.push({ pass: /Role:/i.test(p), label: 'Has Role definition' });
  checks.push({ pass: /Mission:/i.test(p), label: 'Has Mission statement' });
  checks.push({ pass: /Context:/i.test(p) || /User Profile:/i.test(p), label: 'Has Context/User Profile' });
  checks.push({ pass: /Constraints:/i.test(p), label: 'Has Constraints' });
  checks.push({ pass: /Acceptance Criteria:/i.test(p) || /Definition of Done:/i.test(p), label: 'Has Acceptance Criteria' });
  checks.push({ pass: /Output Format:/i.test(p), label: 'Has Output Format' });
  checks.push({ pass: /Tool Permissions:/i.test(p) || /FORBIDDEN:/i.test(p), label: 'Has Tool Permissions' });
  checks.push({ pass: !/\bit\b/i.test(p) || /\b\w+\b.*\bit\b/i.test(p), label: 'No ambiguous pronouns (it)' });
  checks.push({ pass: p.length > 500, label: 'Prompt is substantial (>500 chars)' });
  checks.push({ pass: p.length < 8000, label: 'Prompt fits context window (<8k chars)' });
  
  const passed = checks.filter(c => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  return { checks, passed, total: checks.length, score };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.log('Usage: validate.js <prompt-file.txt>');
    process.exit(1);
  }
  const prompt = fs.readFileSync(file, 'utf-8');
  const result = validatePrompt(prompt);
  console.log(`Validation Score: ${result.score}/100\n`);
  for (const c of result.checks) {
    console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}`);
  }
}

module.exports = { validatePrompt };
