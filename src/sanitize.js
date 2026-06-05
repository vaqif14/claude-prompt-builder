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

module.exports = {
  PROMPT_INJECTION_MARKERS,
  DANGEROUS_BASH_PATTERNS,
  sanitizeCsvValue,
}
