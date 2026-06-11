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

  // 7b. Diagnostic center (6 pts): the prompt must carry a Problem Analysis / solution-direction
  // section — orchestration scaffold without a diagnosis is the failure mode this tool exists to
  // avoid. Presence is scored here; whether it is FILLED is reported as solutionReadiness below
  // (the CLI emits <RESOLVE> slots; the invoking skill fills them after reading the code).
  const hasProblemSection = /PROBLEM ANALYSIS/i.test(p);
  checks.push({ pass: hasProblemSection, label: 'Problem-analysis & solution-direction section present', points: 6 });

  // 7c. Detailed task plan (6 pts): spec-kit-style task rows (IDs + acceptance + deps), not generic
  // verbs. Presence scored here; whether it is FILLED with real file:line is planReadiness below.
  const hasTaskPlan = /TASK PLAN/i.test(p);
  const hasTaskRows = /\b[TF]\d{2,3}\b/.test(p) && /acceptance:|evidence:|depends_on:/i.test(p);
  checks.push({ pass: hasTaskPlan && hasTaskRows, label: 'Detailed task plan (IDs + acceptance + dependencies) present', points: 6 });

  // 7d. Workflow pattern (4 pts): the prompt must name the composable agent shape to run, not
  // only which skills to load (Anthropic "Building Effective Agents").
  const hasWorkflowPattern = /WORKFLOW PATTERN/i.test(p) &&
    /single-pass|prompt-chain|routing|parallel-review|orchestrator-workers|evaluator-optimizer|autonomous-loop/i.test(p);
  checks.push({ pass: hasWorkflowPattern, label: 'Workflow pattern selected (composable shape)', points: 4 });

  // 7e. Verification-first contract (5 pts): claims must be split by the proof that backs them,
  // with blockers named — "if you cannot prove it, do not claim it".
  const hasVerificationContract = /VERIFICATION CONTRACT/i.test(p) &&
    /NO (?:COMPLETION CLAIMS|VERDICT) WITHOUT FRESH/i.test(p) &&
    /Required evidence/i.test(p);
  checks.push({ pass: hasVerificationContract, label: 'Verification-first contract present', points: 5 });

  // 7f. Quality bar (3 pts): the prompt must carry the dev-metrics quality bar that targets 9–10
  // on prompt/context/task-clarity/verification/tool-use — with verification + tool-use called out.
  const hasQualityBar = /QUALITY BAR/i.test(p) && /weak spot|dev-metrics/i.test(p);
  checks.push({ pass: hasQualityBar, label: 'Quality bar (dev-metrics rubric) present', points: 3 });

  // 8. Prompt Length (8 pts)
  const tokens = Math.ceil(p.length / 4);
  const lengthOk = tokens > 200 && tokens < 6800;
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

  // Solution-readiness is ORTHOGONAL to the scaffold score. The score measures whether the
  // orchestration scaffold is well-formed; readiness measures whether the diagnostic center
  // has actually been filled from the code. A 100/100 scaffold with an unfilled PROBLEM
  // ANALYSIS is a DRAFT, not a finished prompt — surfacing this stops the score from reading
  // as "done". 'ready' requires the section present, no <RESOLVE> slots left, and at least one
  // concrete path:line token (a real diagnosis cites a line, not just the words "file:line").
  // Scope these to the PROBLEM ANALYSIS region (up to the next section: WRITE SAFETY GATE for
  // write modes, CONTEXT WINDOW for read-only). Whole-prompt scoping entangled this axis with the
  // plan — an unfilled TASK PLAN would drag solutionReadiness to draft, defeating the two
  // orthogonal axes. Region scoping keeps it measuring ONLY the diagnostic center.
  const probIdx = p.search(/PROBLEM ANALYSIS/i);
  let probRegion = '';
  if (probIdx >= 0) {
    const after = p.slice(probIdx + 'PROBLEM ANALYSIS'.length);
    const nextHdr = after.search(/WRITE SAFETY GATE|CONTEXT WINDOW/i);
    probRegion = nextHdr >= 0 ? after.slice(0, nextHdr) : after;
  }
  const hasUnresolved = /<RESOLVE/i.test(probRegion);
  const hasConcreteLocation = /[\w./-]+\.[A-Za-z]{1,5}:\d+/.test(probRegion);
  const solutionReadiness = !hasProblemSection ? 'missing'
    : (hasUnresolved || !hasConcreteLocation) ? 'draft' : 'ready';

  // planReadiness is a SECOND, orthogonal axis: is the TASK PLAN filled? A prompt can have a filled
  // diagnosis but an unfilled plan. Computed over the task-plan region. Read-only modes produce a
  // findings ledger (a file ref without :line is acceptable there), so we relax the :line need when
  // the plan is a ledger ([Sev]/evidence: present).
  const planIdx = p.search(/TASK PLAN/i);
  const planTail = planIdx >= 0 ? p.slice(planIdx) : '';
  const planEnd = planTail.search(/TOOL DIRECTIVES/i);
  const planRegion = planEnd >= 0 ? planTail.slice(0, planEnd) : planTail;
  const isLedger = /evidence:/i.test(planRegion) && !/depends_on:/i.test(planRegion);
  const planUnresolved = /<RESOLVE/i.test(planRegion);
  const hasFileMap = isLedger || /FILE MAP/i.test(planRegion);
  const planHasLocation = isLedger
    ? /[\w./-]+\.[A-Za-z]{1,5}(:\d+)?/.test(planRegion)
    : /[\w./-]+\.[A-Za-z]{1,5}:\d+/.test(planRegion);
  const planReadiness = !hasTaskPlan ? 'missing'
    : (planUnresolved || !planHasLocation || !hasFileMap) ? 'draft' : 'ready';

  const diagnostics = [];
  if (!isLedger && hasTaskPlan && !/FILE MAP/i.test(planRegion)) {
    diagnostics.push({ code: 'missing-file-map', severity: 'warning', message: 'Write-mode task plan has no FILE MAP.' });
  }
  const taskRows = planRegion.split('\n').filter(line => /^\s*\[ \]\s+T\d{2,3}\b/.test(line));
  for (const row of taskRows) {
    const id = (row.match(/\bT\d{2,3}\b/) || ['task'])[0];
    const locations = row.match(/[\w./-]+\.[A-Za-z]{1,5}:\d+/g) || [];
    if (!locations.length && !/<RESOLVE/i.test(row)) {
      diagnostics.push({ code: 'missing-primary-file', severity: 'warning', task: id, message: `${id} names no primary file.` });
    }
    if (locations.length > 1) {
      diagnostics.push({ code: 'multiple-primary-files', severity: 'warning', task: id, message: `${id} names multiple primary files.` });
    }
    if (!/\|\s*verify:/i.test(row)) {
      diagnostics.push({ code: 'missing-verification', severity: 'warning', task: id, message: `${id} has no verification field.` });
    }
    const description = (row.split('→')[0] || row);
    const conjunctions = (description.match(/\b(?:and|then|plus)\b|[+&]/gi) || []).length;
    if (conjunctions > 2) {
      diagnostics.push({ code: 'too-coarse', severity: 'warning', task: id, message: `${id} likely bundles too many actions.` });
    }
  }

  // Overall readiness: a prompt is only "ready" to hand off when BOTH the diagnosis and the plan
  // are filled from real code.
  const readiness = (solutionReadiness === 'ready' && planReadiness === 'ready') ? 'ready' : 'draft';

  const blockingMarkers = [];
  let currentSection = 'PROMPT';
  const sectionNames = [
    'SYSTEM CONTRACT', 'WORKFLOW PATTERN', 'QUALITY BAR', 'GROUNDED TARGETS',
    'EXPLORATION CONTRACT', 'GROUNDING CONTRACT', 'CLARIFY-FIRST GATE',
    'PROBLEM ANALYSIS', 'WRITE SAFETY GATE', 'CONTEXT WINDOW',
    'SKILL DISCOVERY PREFLIGHT', 'SKILL REVIEW RUBRIC', 'SELECTIVE INSTALL PROFILE',
    'MATCHED SKILLS', 'SKILL SUGGESTIONS', 'MULTI-AGENT TASK BOARD',
    'AGENT REVIEW COUNCIL', 'MODEL ASSIGNMENTS', 'TASK PLAN', 'TOOL DIRECTIVES',
    'CONSTRAINTS', 'STACK BEST PRACTICES', 'STACK ANTI-PATTERNS',
    'STACK VERIFICATION GATES', 'VERIFICATION CONTRACT', 'ACCEPTANCE CRITERIA',
    'OUTPUT SCHEMA',
  ];
  p.split('\n').forEach((line, index) => {
    const heading = sectionNames.find(name => line.includes(name));
    if (heading) currentSection = heading;
    for (const match of line.matchAll(/<RESOLVE[^>]*>/g)) {
      blockingMarkers.push({ line: index + 1, section: currentSection, marker: match[0] });
    }
  });

  return {
    checks,
    passed: checks.filter(c => c.pass).length,
    total: checks.length,
    score,
    grade,
    earnedPoints,
    totalPoints,
    solutionReadiness,
    planReadiness,
    readiness,
    diagnostics,
    blockingMarkers,
  };
}

function formatReport(result) {
  const gradeColor = result.grade === 'pass' ? '\x1b[32m' : result.grade === 'warn' ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  let out = `\n  ${bold}🛡️  Validation Report V2${reset}\n`;
  out += `  ${bold}Scaffold:${reset} ${gradeColor}${result.score}/100${reset} (${result.earnedPoints}/${result.totalPoints} pts)\n`;
  out += `  ${bold}Grade:${reset} ${gradeColor}${result.grade.toUpperCase()}${reset}\n`;
  if (result.solutionReadiness) {
    const r = result.solutionReadiness;
    const rColor = r === 'ready' ? '\x1b[32m' : '\x1b[33m';
    const note = r === 'ready' ? 'diagnosis + concrete fix filled'
      : r === 'draft' ? 'PROBLEM ANALYSIS not filled — open the targets and write the root cause + fix'
        : 'no PROBLEM ANALYSIS section';
    out += `  ${bold}Solution:${reset} ${rColor}${r.toUpperCase()}${reset} — ${note}\n`;
  }
  if (result.planReadiness) {
    const r = result.planReadiness;
    const rColor = r === 'ready' ? '\x1b[32m' : '\x1b[33m';
    const note = r === 'ready' ? 'task plan filled with file:line + acceptance'
      : r === 'draft' ? 'TASK PLAN not filled — write file:line tasks + per-task acceptance from the code'
        : 'no TASK PLAN section';
    out += `  ${bold}Plan:${reset} ${rColor}${r.toUpperCase()}${reset} — ${note}\n`;
  }
  out += '\n';

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
