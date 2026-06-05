/**
 * Sanitization module — v1.5.1 security patch
 * Blocks prompt injection and dangerous bash patterns in CSV values.
 */

const PROMPT_INJECTION_MARKERS = [
  /ignore previous/i,
  /disregard instructions/i,
  /you are now/i,
  /DAN mode/i,
  /jailbreak/i,
  /\{\{.*\}\}/i,
  /<script/i,
  /javascript:/i,
]

const DANGEROUS_BASH_PATTERNS = [
  /curl https?:/i,
  /wget /i,
  /nc -/i,
  /bash -c/i,
  /eval\(/i,
  /fetch\(/i,
  /\$\(.*curl/i,
]

function sanitizeCsvValue(value, sourceFile) {
  if (!value || typeof value !== 'string') return value

  for (const pattern of PROMPT_INJECTION_MARKERS) {
    if (pattern.test(value)) {
      throw new Error(
        `Security violation: prompt injection marker detected in ${sourceFile}: "${value.replace(/"/g, '\\"')}"`
      )
    }
  }

  for (const pattern of DANGEROUS_BASH_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(
        `Security violation: dangerous bash pattern detected in ${sourceFile}: "${value.replace(/"/g, '\\"')}"`
      )
    }
  }

  // Escape newlines to prevent section-breaking in assembled prompts
  return value.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}

/**
 * Neutralize untrusted free-text (the CLI `task`) before it is embedded in a
 * generated prompt or written to a cache file. Escape, do not reject: a task
 * legitimately contains words like "ignore", "eval(", "fetch(", "security review".
 * The real risk is structural — the task forging a new "═══ SECTION ═══" header
 * or an "Authority:" / "Tool Permissions:" line that the downstream agent trusts.
 */
function neutralizeUserText(value, maxLen = 500) {
  if (!value || typeof value !== 'string') return value

  let out = value
    // Strip ANSI escape sequences (terminal-escape spoofing).
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    // Strip other C0/C1 control chars and box-drawing delimiters used as section
    // separators, so the task cannot forge prompt structure.
    .replace(/[\x00-\x1f\x7f─-╿]/g, ' ')
    // Collapse any whitespace (incl. newlines) to single spaces — the task is a
    // one-line intent, not a multi-section document.
    .replace(/\s+/g, ' ')
    .trim()

  if (out.length > maxLen) out = `${out.slice(0, maxLen)}…`
  return out
}

/**
 * Render-safe form for embedding inside a double-quoted shell suggestion such as
 * `npx skills find "<query>"`. The CLI never executes it, but an agent might.
 */
function sanitizeShellArg(value) {
  return neutralizeUserText(value).replace(/["`$;\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

module.exports = {
  PROMPT_INJECTION_MARKERS,
  DANGEROUS_BASH_PATTERNS,
  sanitizeCsvValue,
  neutralizeUserText,
  sanitizeShellArg,
}
