/**
 * Context Diet
 * Scores a generated prompt for context pressure and emits bloat warnings.
 *
 * Source: Anthropic "Effective context engineering for AI agents" — tight, informative
 * context beats large context; repeated discovery and oversized sections are the main
 * failure mode. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
 *
 * This is a diagnostic, not a gate: it never elides sections (the token budgeter does that).
 * It tells the operator whether the prompt is lean, ok, or heavy, and what to trim.
 */

const { estimateTokens } = require('./context-manager');

// A single section above this many tokens is a bloat candidate (move detail to a stack
// profile / reference instead of inlining it).
const SECTION_BLOAT_TOKENS = 850;

// Sections that carry tool/skill/agent discovery text — too many of these is the classic
// "tool overload burns context" smell from the ecosystem signals.
const TOOL_SKILL_NAME = /SKILL|TOOL|AGENT|MULTI-AGENT|COUNCIL|WORKFLOW/i;

/**
 * @param {Array<{name:string, lines:string[]}>} sections
 * @param {object} opts
 * @param {number}  opts.maxTokens             active token budget (default 6000)
 * @param {?string} opts.stackProfileStatus    'hit' | 'miss' | 'refreshed' | null
 * @returns {{estTokens:number, sectionCount:number, toolSkillSections:number,
 *            warnings:string[], recommendedMaxTokens:number, grade:string,
 *            perSection:Array<{name:string, tokens:number}>}}
 */
function scoreContextDiet(sections, opts = {}) {
  const { maxTokens = 6000, stackProfileStatus = null } = opts;

  const perSection = sections.map(s => ({
    name: s.name,
    tokens: estimateTokens((s.lines || []).join('\n')),
  }));
  const estTokens = perSection.reduce((sum, s) => sum + s.tokens, 0);
  const sectionCount = sections.length;
  const toolSkillSections = perSection.filter(s => TOOL_SKILL_NAME.test(s.name)).length;

  const warnings = [];

  for (const s of perSection) {
    if (s.tokens > SECTION_BLOAT_TOKENS) {
      warnings.push(`${s.name} is ${s.tokens}t — large; move reusable detail into .prompt-builder/stack-profiles/<stack>.md instead of inlining.`);
    }
  }

  const status = stackProfileStatus ? String(stackProfileStatus).toLowerCase() : null;
  if (status === null) {
    warnings.push('No stack-profile cache — broad skill-discovery text is inlined on every run; --init-stack-profile caches it so future prompts skip the repeat.');
  } else if (status === 'miss') {
    warnings.push('Stack-profile cache MISS — this run inlines full discovery; subsequent runs will read the cached profile (HIT) and stay leaner.');
  }

  if (toolSkillSections > 6) {
    warnings.push(`${toolSkillSections} tool/skill/agent sections — verify each is needed; tool overload burns context and derails agents.`);
  }

  if (estTokens > maxTokens) {
    warnings.push(`Prompt ~${estTokens}t exceeds budget ${maxTokens}t — lower-priority sections will be compressed/elided. Widen with --max-tokens or trim with a stack profile.`);
  }

  // Recommend a budget that fits the prompt, rounded up to the next 500, capped at 8000.
  const recommendedMaxTokens = Math.min(8000, Math.max(maxTokens, Math.ceil(estTokens / 500) * 500));

  const grade = estTokens <= maxTokens * 0.6 ? 'lean'
    : estTokens <= maxTokens ? 'ok'
      : 'heavy';

  return { estTokens, sectionCount, toolSkillSections, warnings, recommendedMaxTokens, grade, perSection };
}

module.exports = { scoreContextDiet, SECTION_BLOAT_TOKENS };
