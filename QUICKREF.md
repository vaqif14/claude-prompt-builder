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
prompt-builder "design auction card component"

# Explicit mode
prompt-builder --mode design-review "review checkout screen"
prompt-builder --mode security-review "audit auth flow"
prompt-builder --mode performance-review "why is this slow"
prompt-builder --mode release-check "ready to deploy"
prompt-builder --mode prd-to-tasks "break PRD into tasks"

# Platform override
prompt-builder --platform ios "review login screen"

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
const result = generatePrompt("design auction card", { mode: 'design-review' });
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
| Prompt length (800-20k chars) | 8 |
| Stack profile / best practices / anti-patterns / verification | 20 |

**Thresholds:** 80+ pass | 60-79 warn | <60 fail

## Script Map

| Script | Purpose |
|---|---|
| `bin/prompt-builder.js` | CLI entry point |
| `src/index.js` | Main orchestrator |
| `src/platform-detector.js` | 18-platform detection + mixed lanes |
| `src/mode-router.js` | 10-mode inference + mode configs |
| `src/skill-matcher.js` | Skill mapping, agent council, task board |
| `src/prompt-assembler.js` | Prompt generation |
| `src/stack-cache.js` | Project stack profile MD cache |
| `scripts/validate.js` | Validation V2 (quality scoring) |
| `scripts/harness.js` | Agent harness engine |
| `scripts/tool-registry.js` | Tool catalog |
| `scripts/policy-engine.js` | PreToolUse hooks |
| `scripts/state-manager.js` | Session persistence |
| `scripts/error-handler.js` | Structured error handling |
| `scripts/safety-monitor.js` | Circuit breaker + limits |

---

> For explanations of each section see [SKILL.md](./SKILL.md). For prompt templates and architecture patterns see [REFERENCE.md](./REFERENCE.md).
