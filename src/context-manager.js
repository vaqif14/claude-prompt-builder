/**
 * Context Manager
 * Token budgeting and context window management for prompt assembly.
 */

// Single source of truth for section priority during token budgeting.
// 0 = always keep, 1 = keep if space, 2 = compress under pressure, 3 = elide first.
// prompt-assembler derives every section's `priority` from this map — do not
// duplicate these numbers inline in the assembler.
const SECTION_PRIORITIES = {
  'SYSTEM CONTRACT': 0,
  'CLARIFY-FIRST GATE': 0,
  'WORKFLOW PATTERN': 1,
  'QUALITY BAR': 1,
  'GROUNDED TARGETS': 0,
  'GROUNDING CONTRACT': 0,
  'PROBLEM ANALYSIS': 0,
  'WRITE SAFETY GATE': 0,
  'CONTEXT WINDOW': 1,
  'SKILL DISCOVERY PREFLIGHT': 0,
  'SELECTIVE INSTALL PROFILE': 2,
  'SKILL SUGGESTIONS': 0,
  'MATCHED SKILLS': 0,
  'MULTI-AGENT TASK BOARD': 0,
  'AGENT REVIEW COUNCIL': 1,
  'DESIGNER RUBRIC': 3,
  'MODEL ASSIGNMENTS': 3,
  'EXECUTION PLAN': 0,
  'TOOL DIRECTIVES': 0,
  'CONSTRAINTS': 0,
  'STACK BEST PRACTICES TO APPLY': 1,
  'STACK ANTI-PATTERNS TO AVOID': 1,
  'STACK VERIFICATION GATES': 1,
  'VERIFICATION CONTRACT': 0,
  'ACCEPTANCE CRITERIA': 0,
  'OUTPUT SCHEMA': 0,
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}

function assignBudget(sections, maxTokens) {
  const needs = {}
  for (const s of sections) {
    needs[s.name] = estimateTokens(s.lines.join('\n'))
  }

  const budget = {}
  let remaining = maxTokens

  // Pass 1: P0 always keep
  for (const s of sections.filter(s => s.priority === 0)) {
    budget[s.name] = { action: 'keep', allocated: needs[s.name] }
    remaining -= needs[s.name]
  }

  // Pass 2: P1 keep if space
  for (const s of sections.filter(s => s.priority === 1)) {
    if (needs[s.name] <= remaining) {
      budget[s.name] = { action: 'keep', allocated: needs[s.name] }
      remaining -= needs[s.name]
    } else {
      budget[s.name] = { action: 'elide', allocated: 0 }
    }
  }

  // Pass 3: P2 compress if needed
  for (const s of sections.filter(s => s.priority === 2)) {
    if (needs[s.name] <= remaining) {
      budget[s.name] = { action: 'keep', allocated: needs[s.name] }
      remaining -= needs[s.name]
    } else if (remaining > 50) {
      const target = Math.max(Math.floor(remaining * 0.5), 50)
      budget[s.name] = { action: 'compress', allocated: target }
      remaining -= target
    } else {
      budget[s.name] = { action: 'elide', allocated: 0 }
    }
  }

  // Pass 4: P3 elide if tight
  for (const s of sections.filter(s => s.priority === 3)) {
    if (needs[s.name] <= remaining) {
      budget[s.name] = { action: 'keep', allocated: needs[s.name] }
      remaining -= needs[s.name]
    } else {
      budget[s.name] = { action: 'elide', allocated: 0 }
    }
  }

  return budget
}

function compressSection(lines, targetTokens) {
  if (!lines || lines.length === 0) return lines

  const bulletPattern = /^(\s+[•\-✅❌]\s+)/

  // First pass: collapse consecutive bullet items into summaries
  const result = []
  let inList = false
  let listPrefix = ''
  let listItems = []

  function flushList() {
    if (!inList || listItems.length === 0) return
    const count = listItems.length
    if (count > 1) {
      result.push(`  ${listPrefix.trim()} (${count} items — see skill docs for details)`)
    } else if (count === 1) {
      result.push(`  ${listPrefix.trim()} ${listItems[0]}`)
    }
    listItems = []
    inList = false
  }

  for (const line of lines) {
    const match = line.match(bulletPattern)
    if (match) {
      if (!inList) {
        inList = true
        listPrefix = match[1]
      }
      listItems.push(line.replace(bulletPattern, '').trim())
    } else {
      flushList()
      result.push(line)
    }
  }
  flushList()

  // Second pass: remove example-like bullets
  const filtered = result.filter(line => {
    const trimmed = line.trim()
    if (/^\s+[•\-✅❌]\s+(e\.g\.|example|like|such as|for instance)/i.test(trimmed)) {
      return false
    }
    return true
  })

  // Third pass: if still over target, keep header + first content + note
  const currentTokens = estimateTokens(filtered.join('\n'))
  if (currentTokens > targetTokens && filtered.length > 3) {
    const headerLines = []
    let firstContent = null
    for (const line of filtered) {
      if (line.startsWith('═')) {
        headerLines.push(line)
      } else if (firstContent === null && line.trim() && !line.startsWith('═')) {
        firstContent = line
        break
      }
    }
    const compressed = [...headerLines]
    if (firstContent) compressed.push(firstContent)
    compressed.push('  • (section compressed — see skill docs for full details)')
    return compressed
  }

  return filtered
}

let lastReport = null

function getContextReport() {
  return lastReport
}

function buildContextReport(sections, budget) {
  const report = {
    totalTokens: 0,
    maxTokens: 0,
    sections: [],
  }

  for (const section of sections) {
    const used = estimateTokens(section.lines.join('\n'))
    const allocated = budget[section.name]?.allocated || 0
    const action = budget[section.name]?.action || 'keep'
    report.sections.push({ name: section.name, used, allocated, action })
    report.totalTokens += used
  }

  return report
}

function setContextReport(report) {
  lastReport = report
}

module.exports = {
  estimateTokens,
  assignBudget,
  compressSection,
  getContextReport,
  buildContextReport,
  setContextReport,
  SECTION_PRIORITIES,
}
