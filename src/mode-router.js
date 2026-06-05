/**
 * Mode Router
 * Determines prompt mode from task text and provides mode-specific configuration.
 */

const MODES = {
  audit: {
    label: 'Audit / Review',
    keywords: /\b(?:review|audit|check|confirm|verify|qa)\b|all working|işləyir|isleyir|yoxla|tesdiq|təsdiq/,
    authority: 'Read-only audit and verification. Do not modify files unless explicitly asked after the report.',
    subTasks: [
      'Map the exact route, components, hooks, API calls, translations, and auth assumptions',
      'Run static verification: typecheck, lint, and relevant tests where available',
      'Run browser QA on the target route with desktop and mobile viewports',
      'Inspect console errors, failed network calls, loading/empty/error states, and responsive overflow',
      'Compare quality against the project style contract and expectations',
      'Return a verdict backed by evidence; do not claim "all working" unless every gate passes',
    ],
    acceptanceCriteria: [
      'Target renders successfully or the blocker is documented precisely',
      'No critical errors remain unexplained',
      'Typecheck and lint pass, or every failure is listed with file paths and root cause',
      'All data states verified: loading, success, empty, and error',
      'Layouts have no overlap, overflow, or broken controls',
      'Final verdict is one of: Working, Working with issues, Blocked, or Not working',
    ],
    toolPermissions: [
      'READ: freely inspect relevant source, docs, package scripts, and route files',
      'WRITE: blocked; produce findings first',
      'EXECUTE: allowed for non-destructive verification commands only',
      'BROWSER: use Playwright/browser automation when a dev server is available',
      'FORBIDDEN: git commit, git push, production deploy, destructive shell commands',
    ],
    outputSchema: [
      'Verdict: Working | Working with issues | Blocked | Not working',
      'Skill discovery: local skills checked, ecosystem searches run, stronger skill recommendations',
      'Skills invoked: exact skill names used, unavailable skills with reasons',
      'Agent council findings: per-role output with file:line references',
      'Evidence: commands run, URLs checked, screenshots, console/network result',
      'Findings ordered by severity with design-rubric labels',
      'Coverage gaps: what could not be verified and why',
      'Recommended fixes as separate, reviewable tasks',
    ],
  },
  bugfix: {
    label: 'Bugfix / Diagnosis',
    keywords: /\b(?:fix|bug|error|broken|fail(?:s|ed|ing|ure)?|crash(?:es|ed|ing)?|regression)\b|xəta|sehv|səhv/,
    authority: 'Diagnose and fix with minimal change. Escalate if root cause is architectural.',
    subTasks: [
      'Reproduce the issue with exact steps',
      'Isolate root cause with file:line evidence',
      'Implement the smallest fix that resolves the bug',
      'Add regression test',
      'Verify fix with reproduction steps',
      'Update changelog',
    ],
    acceptanceCriteria: [
      'Bug is reproducible before fix',
      'Root cause documented with file:line',
      'Fix is minimal and does not introduce side effects',
      'Regression test covers the bug scenario',
      'All existing tests still pass',
      'Changelog updated',
    ],
    toolPermissions: [
      'READ: all source files',
      'EDIT: targeted fixes only',
      'WRITE: new test files allowed',
      'EXECUTE: reproduction and test commands',
      'FORBIDDEN: unrelated refactors, dependency upgrades',
    ],
    outputSchema: [
      'Reproduction steps',
      'Root cause analysis with file:line',
      'Fix description: change X to Y',
      'Regression test: name and location',
      'Verification evidence',
      'Changelog entry',
    ],
  },
  refactor: {
    label: 'Refactor / Modernize',
    keywords: /\b(?:refactor|rewrite|modernize|clean|debt|extract|decouple)\b/,
    authority: 'Refactor safely with tests as safety net. No behavior change.',
    subTasks: [
      'Map current structure and identify smell',
      'Write characterization tests if coverage is weak',
      'Apply refactor in small steps',
      'Run tests after each step',
      'Verify no behavior change',
      'Update documentation',
    ],
    acceptanceCriteria: [
      'All tests pass before and after',
      'No functional behavior change',
      'Code is cleaner by objective metrics',
      'Characterization tests added where needed',
      'Changelog updated',
    ],
    toolPermissions: [
      'READ: all source files',
      'EDIT: refactor targets',
      'WRITE: test files',
      'EXECUTE: test suite after each step',
      'FORBIDDEN: feature changes, dependency upgrades',
    ],
    outputSchema: [
      'Smell identification',
      'Refactor plan with steps',
      'File:line changes per step',
      'Test results before/after',
      'Metrics improvement (only if a perf fix was made; otherwise N/A)',
      'Changelog entry',
    ],
  },
  feature: {
    label: 'Feature Implementation',
    keywords: /\b(?:add|implement|create|build|rebuild|feature|new|support|enable)\b/, // default fallback
    authority: 'Autonomous execution with human escalation for destructive ops',
    subTasks: [
      'Analyze existing implementations in codebase',
      'Create domain model / DTOs',
      'Implement business logic',
      'Add validation and error handling',
      'Write unit + integration tests',
      'Update documentation and changelog',
    ],
    acceptanceCriteria: [
      'Feature works per user requirements',
      'Unit tests cover happy path + 2 edge cases',
      'Integration test covers end-to-end flow',
      'No compilation errors',
      'CHANGELOG.md updated',
    ],
    toolPermissions: [
      'READ: allowed for all source files',
      'WRITE: allowed within src/ and backend/src/',
      'EDIT: preferred over write for existing files',
      'EXECUTE: allowed for build/test commands only',
      'Agent: allowed for parallel domain analysis',
      'FORBIDDEN: git commit, git push, destructive ops without approval',
    ],
    outputSchema: [
      'Execution plan with active task marked',
      'Skill discovery results',
      'Concrete file:line changes',
      'Test additions with test names',
      'Changelog entry',
      'Metadata card: Complexity | Risk | Rollback plan',
    ],
  },
  'design-review': {
    label: 'Design Review',
    keywords: /\b(?:design|visual|ui|ux)\b[\w\s-]*\b(?:review|audit|critique|polish|check)\b|\b(?:review|audit|critique)\b[\w\s-]*\b(?:design|visual|ui|ux)\b|does this look good/,
    authority: 'Read-only design audit. No code changes unless user asks for fixes after.',
    subTasks: [
      'Capture screenshots at key breakpoints (375, 768, 1024, 1440)',
      'Audit visual hierarchy, spacing, typography, color discipline',
      'Check interaction states: hover, focus, active, disabled, loading, empty, error',
      'Verify accessibility: contrast, keyboard nav, screen reader labels',
      'Check dark/light parity',
      'Rate against project style contract',
    ],
    acceptanceCriteria: [
      'Screenshots captured at all breakpoints',
      'Design rubric scored per category',
      'Accessibility issues documented with WCAG reference',
      'Verdict: Meets design bar | Working with design issues | Needs redesign',
    ],
    toolPermissions: [
      'READ: source files for context',
      'WRITE: blocked',
      'BROWSER: screenshots, console, network',
      'FORBIDDEN: any code modification',
    ],
    outputSchema: [
      'Screenshot gallery per breakpoint',
      'Design rubric scores',
      'Accessibility findings',
      'Prioritized fix list (cosmetic → structural)',
      'Verdict with reasoning',
    ],
  },
  'architecture-review': {
    label: 'Architecture Review',
    keywords: /architecture review|structure review|is this well structured|hexagonal|clean arch|domain driven|ddd/,
    authority: 'Read-only architecture audit. No refactoring unless explicitly requested.',
    subTasks: [
      'Map module/layer boundaries',
      'Identify coupling and cohesion issues',
      'Check dependency direction (inward vs outward)',
      'Evaluate testability',
      'Compare against known patterns (hexagonal, onion, clean)',
      'Document risks and recommended restructure',
    ],
    acceptanceCriteria: [
      'Layer map drawn or described',
      'Coupling issues ranked by severity',
      'Dependency violations listed with file:line',
      'Testability score per module',
      'Restructure recommendation if needed',
    ],
    toolPermissions: [
      'READ: all source files',
      'WRITE: blocked',
      'FORBIDDEN: code changes',
    ],
    outputSchema: [
      'Architecture map',
      'Coupling/cohesion findings',
      'Dependency violation list',
      'Testability assessment',
      'Restructure recommendation with effort estimate',
    ],
  },
  'security-review': {
    label: 'Security Review',
    keywords: /security review|is this secure|cve|vulnerability|penetration|pentest|auth audit/,
    authority: 'Read-only security audit. Escalate immediately for confirmed vulnerabilities.',
    subTasks: [
      'AuthZ/AuthN flow review',
      'Input validation and sanitization check',
      'Secret/credential handling audit',
      'CORS, CSP, and header review',
      'Dependency vulnerability scan',
      'Data exposure and PII check',
    ],
    acceptanceCriteria: [
      'All auth flows traced and documented',
      'Input vectors identified and validated',
      'No hardcoded secrets or tokens',
      'Security headers verified',
      'Dependency scan complete',
      'Risk rating per finding: Critical | High | Medium | Low',
    ],
    toolPermissions: [
      'READ: all source, config, and dependency files',
      'EXECUTE: security scan commands',
      'WRITE: blocked unless fixing with approval',
      'FORBIDDEN: production changes',
    ],
    outputSchema: [
      'Security findings with CWE/OSV reference',
      'Risk rating per finding',
      'Reproduction steps for confirmed issues',
      'Fix recommendations',
      'Residual risk assessment',
    ],
  },
  'performance-review': {
    label: 'Performance Review',
    keywords: /performance review|why is this slow|lag|optimize|benchmark|profile|memory leak|cpu/,
    authority: 'Performance audit. Measure before claiming.',
    subTasks: [
      'Establish baseline metrics (load time, TTI, memory, CPU)',
      'Profile hot paths with actual measurements',
      'Identify N+1 queries, redundant renders, large bundles',
      'Check caching strategy',
      'Measure after proposed fix',
    ],
    acceptanceCriteria: [
      'Baseline metrics documented',
      'Hot paths identified with profiler evidence',
      'Root causes linked to file:line',
      'Post-fix measurements show improvement',
      'No regressions introduced',
    ],
    toolPermissions: [
      'READ: source and config',
      'EXECUTE: profiling, benchmarking, load tests',
      'WRITE: blocked unless optimizing with approval',
      'FORBIDDEN: premature optimization without measurement',
    ],
    outputSchema: [
      'Baseline metrics table',
      'Profiler hot path evidence',
      'Root cause analysis',
      'Optimization recommendation',
      'Post-optimization metrics',
      'Regression check result',
    ],
  },
  'release-check': {
    label: 'Release Readiness Check',
    keywords: /release|deploy|ship|ready to deploy|go live|production ready|cut release/,
    authority: 'Read-only release verification. Block release on critical findings.',
    subTasks: [
      'Version bump and changelog completeness',
      'All tests pass (unit, integration, e2e)',
      'Typecheck and lint clean',
      'Security scan clean',
      'Performance baseline acceptable',
      'Rollback plan documented',
    ],
    acceptanceCriteria: [
      'CHANGELOG.md updated with version and date',
      'All automated gates pass',
      'No unaddressed critical/high issues',
      'Rollback steps documented and tested',
      'Deployment checklist complete',
    ],
    toolPermissions: [
      'READ: source, config, docs',
      'EXECUTE: build, test, lint, security scan',
      'WRITE: blocked',
      'FORBIDDEN: deployment without approval',
    ],
    outputSchema: [
      'Gate pass/fail table',
      'Open issues with severity',
      'Rollback plan',
      'Go/No-Go recommendation',
    ],
  },
  'prd-to-tasks': {
    label: 'PRD to Tasks',
    keywords: /prd|spec|requirements|break this into tasks|user story|epic|ticket/,
    authority: 'Decompose requirements into actionable engineering tasks.',
    subTasks: [
      'Parse PRD into user stories / features',
      'Identify dependencies and ordering',
      'Estimate complexity per task',
      'Assign platform/skill per task',
      'Define done criteria per task',
      'Output task board with IDs',
    ],
    acceptanceCriteria: [
      'Every PRD requirement maps to ≥1 task',
      'Dependencies are explicit and acyclic',
      'Complexity estimates are realistic',
      'Each task has a clear owner and done gate',
      'Task board is paste-ready into issue tracker',
    ],
    toolPermissions: [
      'READ: PRD, existing codebase for context',
      'WRITE: task board output only',
      'FORBIDDEN: code changes',
    ],
    outputSchema: [
      'Task board: id | title | owner | complexity | dependencies | done gate',
      'PRD coverage map: requirement → task ids',
      'Risk/assumption list',
      'Recommended issue tracker format',
    ],
  },
};

function inferMode(task, explicitMode) {
  if (explicitMode && MODES[explicitMode]) return explicitMode;

  const lower = task.toLowerCase();

  // Quality-vs-bug guard: a "fix the code quality / best-practice deviations" task is a
  // refactor, not a bugfix — the bare word "fix" must not route it to bugfix unless there
  // is an actual acute-bug signal (something broken/throwing/failing).
  const qualitySignal = /\b(?:code quality|best[ -]practices?|smells?|maintainability|readability|tech(?:nical)? debt|clean ?up|deviations?|modernize)\b/.test(lower);
  const acuteBug = /\b(?:bug|bugs|broken|crash(?:es|ed|ing)?|error|errors|exception|regression|stack ?trace|throws?|fails?|failing|failure|npe|500)\b/.test(lower);
  if (qualitySignal && !acuteBug) return 'refactor';

  // Order matters: check specific modes before general ones to avoid false positives
  const modeOrder = [
    'design-review', 'architecture-review', 'security-review', 'performance-review',
    'release-check', 'prd-to-tasks',
    'audit', 'bugfix', 'refactor', 'feature'
  ];

  for (const modeKey of modeOrder) {
    if (MODES[modeKey].keywords.test(lower)) return modeKey;
  }

  return 'feature';
}

function getModeConfig(mode) {
  return MODES[mode] || MODES.feature;
}

function listModes() {
  return Object.entries(MODES).map(([key, config]) => ({
    key,
    label: config.label,
    keywords: config.keywords.source,
  }));
}

module.exports = { inferMode, getModeConfig, listModes, MODES };
