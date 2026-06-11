/**
 * Workflow Router
 * Selects the Anthropic-style agent workflow pattern for a task, so the generated
 * prompt tells the next agent WHICH workflow shape to run — not only which skills to load.
 *
 * Source: Anthropic "Building Effective Agents" — prefer simple composable patterns
 * (routing, prompt chaining, parallelization, orchestrator-workers, evaluator-optimizer)
 * before reaching for an autonomous loop. https://www.anthropic.com/engineering/building-effective-agents
 */

// Each pattern carries a one-line shape the prompt can paste verbatim (kept short on purpose —
// the whole WORKFLOW PATTERN section must stay under ~120 tokens).
const PATTERNS = {
  'single-pass': 'One agent, one pass: read the resolved targets, do the work, verify inline. No decomposition.',
  'prompt-chain': 'Sequential gated stages — each stage starts only when the previous one is green (e.g. characterize → change → verify). Use when steps have a hard order.',
  routing: 'Classify the input first, then dispatch each part to its matching specialist lane. Use when the work splits into distinct categories.',
  'parallel-review': 'Independent review passes run concurrently in isolated contexts (no shared scratchpad), then a synthesis pass reconciles and de-dupes findings. Use for audits/reviews.',
  'orchestrator-workers': 'A coordinator decomposes the work, delegates owned subtasks to worker agents (one surface each), then integrates. Use for multi-surface or high-complexity builds.',
  'evaluator-optimizer': 'A generator proposes a change; an evaluator critiques it against the acceptance gate; loop until it passes. Use for bugfixes and quality-bar work.',
  'autonomous-loop': 'Agent plans → acts → observes → self-corrects in a checkpointed loop. Use ONLY when the task is open-ended and no simpler pattern fits — most tasks do not need this.',
};

const READ_ONLY_MODES = new Set([
  'audit', 'design-review', 'architecture-review', 'security-review',
  'performance-review', 'release-check', 'agent-readiness', 'tooling-review', 'skill-review',
]);

/**
 * @param {object} ctx
 * @param {string} ctx.mode        resolved mode key
 * @param {string} ctx.complexity  'Low' | 'Medium' | 'High'
 * @param {Array}  ctx.platforms   detected platform objects (id/label)
 * @param {number} ctx.agentCount  number of council/board agents
 * @param {string} ctx.task        raw task text (for explicit-intent overrides)
 * @returns {{pattern:string, description:string, rationale:string}}
 */
function selectWorkflowPattern(ctx = {}) {
  const { mode = 'feature', complexity = 'Medium', platforms = [], agentCount = 1, task = '' } = ctx;
  const lower = String(task).toLowerCase();
  const multiSurface = platforms.length > 1;
  const high = complexity === 'High';
  const readOnly = READ_ONLY_MODES.has(mode);

  let pattern;
  let rationale;

  if (/\bautonomous\b|\bagent loop\b|\bself[\s-]?heal|\bloop until\b/.test(lower)) {
    pattern = 'autonomous-loop';
    rationale = 'Task text asks for open-ended/autonomous operation; checkpoint it so it cannot run unbounded.';
  } else if (readOnly) {
    pattern = 'parallel-review';
    rationale = 'A read-only review benefits from independent passes in fresh contexts that cannot bias each other, reconciled at the end.';
  } else if (mode === 'bugfix') {
    pattern = 'evaluator-optimizer';
    rationale = 'A fix must be proven against a failing repro; generate-then-evaluate loops until the regression test is green.';
  } else if (mode === 'refactor') {
    pattern = 'prompt-chain';
    rationale = 'Refactors have a hard order (characterize → extract → verify); each stage gates the next so behavior never drifts unobserved.';
  } else if (mode === 'prd-to-tasks') {
    pattern = 'routing';
    rationale = 'A PRD decomposes into categories of work that route to different owners; classify first, then dispatch.';
  } else if (mode === 'hackathon' || multiSurface || high || agentCount >= 4) {
    pattern = 'orchestrator-workers';
    rationale = multiSurface
      ? 'Multiple surfaces need parallel owners with a coordinator integrating their handoffs.'
      : 'High complexity / many agents — a coordinator must decompose and integrate rather than one agent doing everything.';
  } else {
    pattern = 'single-pass';
    rationale = 'A single, low-complexity surface does not justify decomposition overhead — one focused pass with inline verification.';
  }

  return { pattern, description: PATTERNS[pattern], rationale };
}

function listPatterns() {
  return Object.keys(PATTERNS);
}

module.exports = { selectWorkflowPattern, listPatterns, PATTERNS };
