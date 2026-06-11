# Prompt Builder — Quick Reference

> Cheat sheet. For full usage guide see [SKILL.md](./SKILL.md). For deep theory and templates see [REFERENCE.md](./REFERENCE.md).

---

## One-liner install

```bash
npm install -g @vaqif14/prompt-builder
```

## CLI commands

```bash
# Auto-detect mode and platform
prompt-builder "design pricing card component"

# Explicit mode
prompt-builder --mode design-review "review checkout screen"
prompt-builder --mode security-review "audit auth flow"
prompt-builder --mode performance-review "why is this slow"
prompt-builder --mode release-check "ready to deploy"
prompt-builder --mode prd-to-tasks "break PRD into tasks"
prompt-builder --mode hackathon "build the mvp for our demo"
prompt-builder --mode agent-readiness "audit our .claude setup"
prompt-builder --mode tooling-review "check mcp readiness"
prompt-builder --mode skill-review "review this skill for bloat"

# Platform override
prompt-builder --platform ios "review login screen"

# Context diet + selective install profile
prompt-builder --context-report "refactor api"     # token usage + diet (lean/ok/heavy) + bloat warnings
prompt-builder --profile web "add a dashboard"      # curated, capped, approval-required skill set
prompt-builder --profile ai-agent "add a RAG step"  # profiles: web | backend | mobile | ai-agent | hackathon

# Skill discovery (opt-in; offline-degrading) + draft enforcement
prompt-builder --discover "redesign admin dashboard"   # check installed vs ecosystem; emit SKILL SUGGESTIONS
prompt-builder --no-discover "add timer"               # offline; static matches labeled "? unverified"
prompt-builder --refresh-skills --discover "audit api" # ignore the 24h discovery cache
prompt-builder --dismiss-skill some-skill              # stop suggesting a skill (per project)
prompt-builder --save out.txt "fix bug"                # REFUSES a draft (unfilled <RESOLVE>); lists markers
prompt-builder --save-draft out.txt "fix bug"          # write the draft anyway

# Stack profile cache
prompt-builder --init-stack-profile --stack nextjs
prompt-builder --refresh-stack-profile "review admin dashboard"
prompt-builder --no-stack-cache "one-off prompt"

# Output formats
prompt-builder --compact "add timer"           # minimal output
prompt-builder --json "fix bug"                 # JSON for piping
prompt-builder --save prompt.txt "refactor api" # save to file
prompt-builder --print-skills-only "design card" # matched skills only

# Discovery
prompt-builder --list-modes
prompt-builder --list-stacks

# Validate prompt file
prompt-builder --validate prompt.txt
```

## Library

```js
const { generatePrompt, platformDetector, modeRouter, skillMatcher } = require('@vaqif14/prompt-builder');

// Generate prompt
const result = generatePrompt("design pricing card", { mode: 'design-review' });
console.log(result.prompt);
console.log(result.metadata.platforms);  // ['web']
console.log(result.metadata.mode);       // 'design-review'
console.log(result.validation.score);    // 90

// Platform detection
const platforms = platformDetector.detectPlatformsMixed("ios app with backend api");
// ['ios', 'backend', 'integration']

// Mode inference
const mode = modeRouter.inferMode("review admin dashboard"); // 'audit'

// Skill matching
const analysis = skillMatcher.analyzeTask("fix login bug");
// { domains: [...], complexity: 'Low', agentCount: 3 }
```

## Modes

| Mode | CLI Flag | When to use |
|---|---|---|
| feature | (default) | Add, implement, create, build |
| audit | `--mode audit` | Review, check, verify, QA |
| bugfix | `--mode bugfix` | Fix, bug, error, broken |
| refactor | `--mode refactor` | Refactor, clean, modernize |
| design-review | `--mode design-review` | Visual/design audit |
| architecture-review | `--mode architecture-review` | Structure, coupling, patterns |
| security-review | `--mode security-review` | Security, auth, CVE |
| performance-review | `--mode performance-review` | Slow, optimize, profile |
| release-check | `--mode release-check` | Ready to deploy |
| prd-to-tasks | `--mode prd-to-tasks` | Break PRD into tasks |
| hackathon | `--mode hackathon` | Domain-first narrow MVP + demo proof |
| agent-readiness | `--mode agent-readiness` | `.claude` portfolio audit (read-only) |
| tooling-review | `--mode tooling-review` | MCP/CLI tool & auth readiness (read-only) |
| skill-review | `--mode skill-review` | Agent-skill quality / bloat (read-only) |

## Every prompt also carries

- **Workflow Pattern** — the composable agent shape to run (`single-pass` … `orchestrator-workers` … only `autonomous-loop` when warranted).
- **Verification Contract** — claims split by proof: provable-by-source / -command / -browser-device / blocked-by. No proof → "Blocked", never an optimistic "Working".
- **Context Diet** — `lean`/`ok`/`heavy` grade + bloat warnings (`metadata.contextDiet`, `--context-report`).
- **Quality Bar (dev-metrics aligned)** — engineered to score 9–10 on the 6 session-scorer dimensions (prompt/context/response/task-clarity/verification/tool-use); calls out the weak spots (verification, tool use). `metadata.qualityRubric` reports coverage + gaps.

## Platforms (auto-detected)

```
web, backend, ios, android, flutter, react-native, desktop, cli, devops, ai, laravel, python, go, rust, dotnet, unity, data-ml, db
```

## Validation V2 Scoring

| Gate | Points |
|---|---|
| Skill discovery preflight | 7 |
| Stack-specific discovery or cache | 5 |
| Platform detected with evidence | 12 |
| Agent roster / task board | 12 |
| Evidence gates defined | 12 |
| Stop conditions | 8 |
| Output schema actionable | 8 |
| Not generic (no placeholders) | 8 |
| Workflow pattern selected | 4 |
| Verification-first contract present | 5 |
| Prompt length (800-20k chars) | 8 |
| Stack profile / best practices / anti-patterns / verification | 20 |

Plus orthogonal readiness axes (not part of the scaffold score): `solutionReadiness`, `planReadiness` → combined `readiness` (READY only when both the diagnosis and the task plan are filled from real code).

**Thresholds:** 80+ pass | 60-79 warn | <60 fail

## Script Map

| Script | Purpose |
|---|---|
| `bin/prompt-builder.js` | CLI entry point |
| `src/index.js` | Main orchestrator |
| `src/platform-detector.js` | 18-platform detection + mixed lanes |
| `src/mode-router.js` | 14-mode inference + mode configs |
| `src/skill-matcher.js` | Skill mapping, agent council, task board |
| `src/workflow-router.js` | Composable agent workflow-pattern selection |
| `src/prompt-assembler.js` | Prompt generation |
| `src/stack-cache.js` | Project stack profile MD cache |
| `src/model-router.js` | Complexity-based model selection |
| `src/context-manager.js` | Token budgeting + section priorities |
| `src/context-diet.js` | Context-pressure scoring + bloat warnings |
| `src/install-profiles.js` | Curated, capped selective-install profiles |
| `src/quality-rubric.js` | dev-metrics 6-dimension quality bar + self-assessment |
| `src/sanitize.js` | CSV sanitization + untrusted-task neutralization |
| `src/session-store.js` | Session persistence (~/.prompt-builder) |
| `src/error-handler.js` | Structured error categorization |
| `scripts/validate.js` | Validation V2 (quality scoring) |
| `scripts/generate-manifest.js` | Rebuild data SHA-256 manifest |

---

> For explanations of each section see [SKILL.md](./SKILL.md). For prompt templates and architecture patterns see [REFERENCE.md](./REFERENCE.md).
