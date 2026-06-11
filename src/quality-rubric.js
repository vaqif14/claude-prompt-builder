/**
 * Quality Rubric (dev-metrics aligned)
 * Encodes the six session-quality dimensions the dev-metrics `session-scorer` rates 1–10, and
 * the rubric-9/10 behaviors for each. Prompt Builder's job is to emit a prompt that makes the
 * resulting session score at the top of every dimension — so we (a) inject a compact QUALITY BAR
 * that tells the executing agent the bar to hit, and (b) self-assess whether the generated prompt
 * actually carries the rubric-lifting elements, flagging gaps for the SKILL to fill.
 *
 * Source rubric: dev-metrics/skills/session-scorer/SKILL.md (prompt_quality, context_provision,
 * response_quality, task_clarity, verification_rigor, tool_utilization). Org-wide weak spots are
 * verification_rigor and tool_utilization, so the QUALITY BAR emphasizes those.
 */

// The six dimensions, each with the top-of-rubric (9–10) behavior the prompt must drive, and the
// signals we look for in the generated prompt to confirm it carries that lever.
const RUBRIC = [
  {
    key: 'prompt_quality',
    label: 'Prompt quality',
    target: 'file:line refs + error output + expected-vs-actual + constraints + what was tried + a hypothesis',
    signals: [/expected\s*(?:vs\.?|versus|\/)\s*actual/i, /hypothesis/i, /already tried|prior attempts|what was tried/i],
  },
  {
    key: 'context_provision',
    label: 'Context provision',
    target: 'artifacts + business context (why it matters) + related systems + environment + which tests to verify against',
    signals: [/why it matters|business context/i, /related systems|dependencies/i, /tests to verify|which tests/i],
  },
  {
    key: 'response_quality',
    label: 'Response to clarifications',
    target: 'when a clarifying question is asked, answer it comprehensively and anticipate the follow-ups in one reply',
    signals: [/clarif/i, /anticipat/i],
  },
  {
    key: 'task_clarity',
    label: 'Task clarity',
    target: 'goal + scope + acceptance criteria + constraints + edge cases + explicit non-goals',
    signals: [/non-goals?/i, /edge cases?/i, /acceptance:/i],
  },
  {
    key: 'verification_rigor',
    label: 'Verification rigor',
    target: 'read diffs, re-run the full suite, check side-effects/regressions, validate every file ref, catch silent failures — treat output as suspect until proven',
    signals: [/read (?:the )?diff/i, /side[- ]effects|regress/i, /silent failures?/i, /VERIFICATION CONTRACT/i],
  },
  {
    key: 'tool_utilization',
    label: 'Tool utilization',
    target: 'right Claude Code feature per step: plan mode, parallel sub-agents, slash commands, CLAUDE.md/memory, hooks, MCP',
    signals: [/sub-?agents?|parallel/i, /plan mode|WORKFLOW PATTERN/i, /CLAUDE\.md|memory/i],
  },
];

/**
 * Compact QUALITY BAR section lines — the bar the executing session must clear, mapped to the
 * dev-metrics dimensions. Kept short (context-diet aware); emphasizes the org's weak spots.
 * @param {boolean} isReadOnly
 * @returns {string[]}
 */
function buildQualityBar(isReadOnly) {
  return [
    '═══════════════════════════════════════════════════════════════',
    '  QUALITY BAR — hit 9–10 on every dev-metrics dimension',
    '═══════════════════════════════════════════════════════════════',
    '',
    'Engineered to score at the top of the session-quality rubric — hold that bar:',
    '  • Prompt/Task clarity: every claim names a file:line; state expected-vs-actual, constraints, edge cases, and explicit non-goals.',
    '  • Context: carry the artifacts, why-it-matters, related systems/dependencies, environment, and which tests prove it.',
    '  • Verification (the weak spot): read every diff, re-run the full suite, check side-effects/regressions, validate each file ref, catch silent failures — treat output as suspect until proven, never "compiled, done".',
    '  • Tool use (the weak spot): use the right feature per step — plan mode for design, parallel sub-agents for independent work, slash commands for review, CLAUDE.md/memory for durable facts.',
    ...(isReadOnly ? ['  • A review answers clarifications comprehensively in one pass; do not bounce questions back piecemeal.'] : ['  • Answer any clarifying question comprehensively in one reply — anticipate the follow-up.']),
    '',
  ];
}

/**
 * Self-assess whether the generated prompt carries the rubric-lifting elements per dimension.
 * Heuristic (presence of signals), mirrors context-diet's diagnostic role — it does not gate,
 * it tells the operator/SKILL which dimensions still need filling.
 * @param {string} promptText
 * @returns {{dimensions:Array<{key,label,target,covered:boolean}>, gaps:string[], weakest:string|null, covered:number, total:number}}
 */
function assessPromptQuality(promptText) {
  const p = String(promptText || '');
  const dimensions = RUBRIC.map(d => ({
    key: d.key,
    label: d.label,
    target: d.target,
    covered: d.signals.some(rx => rx.test(p)),
  }));
  const gaps = dimensions.filter(d => !d.covered).map(d => `${d.label}: add ${d.target}`);
  const weakest = dimensions.find(d => !d.covered)?.key || null;
  const covered = dimensions.filter(d => d.covered).length;
  return { dimensions, gaps, weakest, covered, total: dimensions.length };
}

module.exports = { RUBRIC, buildQualityBar, assessPromptQuality };
