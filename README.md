# [Prompt Builder](https://github.com/vaqif14/claude-prompt-builder)

<p align="center">
  <a href="https://www.npmjs.com/package/@vaqif14/prompt-builder"><img src="https://img.shields.io/npm/v/@vaqif14/prompt-builder?style=for-the-badge&color=blue&logo=npm" alt="npm version"></a>
  <img src="https://img.shields.io/badge/platforms-18-green?style=for-the-badge" alt="18 Platforms">
  <img src="https://img.shields.io/badge/modes-10-purple?style=for-the-badge" alt="10 Modes">
  <img src="https://img.shields.io/badge/agent_harness-7_layers-orange?style=for-the-badge" alt="7-Layer Agent Harness">
  <a href="https://github.com/vaqif14/claude-prompt-builder/blob/main/LICENSE"><img src="https://img.shields.io/github/license/vaqif14/claude-prompt-builder?style=for-the-badge&color=green" alt="License"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@vaqif14/prompt-builder"><img src="https://img.shields.io/npm/dm/@vaqif14/prompt-builder?style=flat-square&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/vaqif14/claude-prompt-builder/stargazers"><img src="https://img.shields.io/github/stars/vaqif14/claude-prompt-builder?style=flat-square&logo=github" alt="GitHub stars"></a>
</p>

Turn vague tasks like `"yoxla bu səhifəni"` or `"timer əlavə et"` into professional, paste-ready **agent orchestration prompts**. Auto-detects platform, discovers skills, assigns agents, and builds a task board.

---

## What's New in v1.4.0

### Universal Agent Orchestration Planner

The flagship feature of v1.4.0 is the **Orchestration Engine** — an AI-powered planner that analyzes your task, detects platforms, matches skills, and generates a complete agent brief with task cards.

```
+----------------------------------------------------------------------------------------+
|  TARGET: "review admin dashboard and confirm all working"                              |
+----------------------------------------------------------------------------------------+
|                                                                                        |
|  PLATFORM DETECTION                                                                    |
|     Web / Frontend  →  signals: React/Next/dashboard/component wording                 |
|     Stack: nextjs | Default skills: frontend-patterns, ui-ux-pro-max, browser-qa       |
|                                                                                        |
|  MODE: audit (auto-detected from "review" + "confirm")                                 |
|     Authority: Read-only audit and verification                                        |
|     SubTasks: Map route → Static verification → Browser QA → Verdict                   |
|                                                                                        |
|  MATCHED SKILLS                                                                        |
|     • find-skills — discover newer/more specialized skills                             |
|     • enterprise-ui-architect — admin dashboard structure, MUI quality                 |
|     • ui-ux-pro-max — visual design system, spacing, palette, typography               |
|     • emil-design-eng — micro-polish, interaction feel, designer-eye critique          |
|     • frontend-patterns — Next.js/component architecture                               |
|     • browser-qa — runtime UI proof via screenshots, console, network                  |
|     • verification-loop — static gates: typecheck, lint, build, test                   |
|                                                                                        |
|  MULTICA TASK BOARD                                                                    |
|     T0 | Coordinator      | Normalize request and define task graph         | todo     |
|     T1 | Skill Scout       | Discover local and ecosystem skills             | todo     |
|     P1 | Frontend Agent    | Audit pass for Web / Frontend                   | todo     |
|     Q1 | QA/Verification   | Run verification gates and collect evidence     | todo     |
|     S1 | Coordinator       | Synthesize findings and produce final answer    | todo     |
|                                                                                        |
|  VERDICT SCHEMA                                                                        |
|     Working | Working with issues | Blocked | Not working                            |
|                                                                                        |
|  DESIGNER-EYE RUBRIC                                                                   |
|     [ ] First-glance clarity (5-second test)                                           |
|     [ ] Visual hierarchy: primary actions dominant                                     |
|     [ ] Spacing rhythm: grids, cards, filters align                                    |
|     [ ] Typography: clear scale and weight                                             |
|     [ ] Color discipline: semantic tokens only                                         |
|     [ ] Interaction states: hover, focus, disabled, loading, empty, error              |
|     [ ] Responsive: 375px, 768px, 1024px, 1440px                                     |
|     [ ] Dark/light parity preserved                                                    |
|     [ ] Accessibility: WCAG AA contrast, keyboard nav, screen reader                   |
|     [ ] Enterprise polish: feels production, not demo                                  |
|                                                                                        |
+----------------------------------------------------------------------------------------+
```

### How Orchestration Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. USER REQUEST                                                │
│     "review admin dashboard and confirm that all working"       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. PLATFORM DETECTION (18 platforms)                           │
│     • Web/Frontend  →  React, Next.js, Vue, Angular             │
│     • Backend       →  Spring Boot, FastAPI, Django, Go, Node   │
│     • Mobile        →  iOS, Android, Flutter, React Native      │
│     • Other         →  Desktop, CLI, DevOps, AI/ML, Game, DB    │
│     Mixed-platform  →  Separate lanes + Integration lane        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. MODE ROUTER (10 modes)                                      │
│     • audit, bugfix, refactor, feature                          │
│     • design-review, architecture-review, security-review       │
│     • performance-review, release-check, prd-to-tasks           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. SKILL MATCHER                                               │
│     • Keyword-based domain detection                            │
│     • Agent council generation (Designer, Architect, QA, etc.)  │
│     • Universal agent roster per platform                       │
│     • Multica task board with dependencies                      │
│     • Designer-eye rubric for UI tasks                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. PROMPT ASSEMBLY (14 sections)                               │
│     System Contract → Context Window → Skill Discovery          │
│     → Matched Skills → Agent Roster → Task Board                │
│     → Agent Council → Execution Plan → Tool Directives          │
│     → Constraints → Stop Conditions → Acceptance Criteria       │
│     → Evidence Gates → Output Schema                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

- **18 Platforms** — Web, Backend, iOS, Android, Flutter, React Native, Desktop, CLI, DevOps, AI/ML, Laravel, Python, Go, Rust, .NET, Unity, Data/ML, DB
- **10 Prompt Modes** — feature, audit, bugfix, refactor, design-review, architecture-review, security-review, performance-review, release-check, prd-to-tasks
- **Mixed-Platform Lanes** — Auto-creates integration lane when multiple platforms detected
- **Skill Discovery Preflight** — Scans local skills + ecosystem search + install recommendations
- **Multica Task Board** — Task cards with id | owner | title | status | depends_on | artifact
- **Agent Review Council** — Designer, Architect, Frontend, Backend, Security, Performance, QA roles
- **Designer-Eye Rubric** — 10-point visual audit checklist for UI tasks
- **Validation V2** — Quality scoring (100 pts) replacing trivial presence checks
- **7-Layer Agent Harness** — Tool Registry, Policy Engine, State Manager, Error Handler, Safety Monitor

### Supported Platforms

| Category | Platforms |
|----------|-----------|
| **Web** | React, Next.js, Vue, Svelte, Angular, HTML + Tailwind |
| **Backend** | Spring Boot, Node.js, FastAPI, Django, Flask, Go, Rust, .NET, Laravel, PHP |
| **Mobile** | iOS (Swift/SwiftUI), Android (Kotlin/Compose), Flutter, React Native |
| **Desktop** | Electron, Tauri, native apps |
| **Other** | CLI/Tooling, DevOps/CI-CD, AI/ML/RAG, Game (Unity), Data/ML pipelines, Database |

### Available Modes (10)

| Mode | Trigger Keywords | Authority |
|------|-----------------|-----------|
| **feature** | add, implement, create, build | Autonomous execution |
| **audit** | review, check, verify, yoxla | Read-only audit |
| **bugfix** | fix, bug, error, xəta | Diagnose and fix |
| **refactor** | refactor, clean, modernize | Refactor safely |
| **design-review** | design review, visual audit, "does this look good" | Read-only design audit |
| **architecture-review** | architecture, hexagonal, "is this well structured" | Read-only structure audit |
| **security-review** | security, cve, vulnerability | Read-only security audit |
| **performance-review** | slow, optimize, profile | Performance audit |
| **release-check** | release, deploy, ship | Release readiness |
| **prd-to-tasks** | prd, spec, "break into tasks" | PRD decomposition |

---

## Installation

### Using npx (No Install)

```bash
npx @vaqif14/prompt-builder "design auction card component"
```

### Global Install

```bash
npm install -g @vaqif14/prompt-builder
```

### As a Library

```bash
npm install @vaqif14/prompt-builder
```

---

## Usage

### CLI

```bash
# Default — mode and platform auto-detected
prompt-builder "review admin dashboard and confirm that all working"

# Explicit mode
prompt-builder --mode design-review "review checkout screen"
prompt-builder --mode security-review "audit auth flow"
prompt-builder --mode performance-review "why is this slow"
prompt-builder --mode release-check "ready to deploy"
prompt-builder --mode prd-to-tasks "break auction PRD into tasks"

# Platform override
prompt-builder --platform ios "review login screen"

# Output formats
prompt-builder --compact "add timer"              # minimal output
prompt-builder --json "fix bug"                   # JSON for piping
prompt-builder --save prompt.txt "refactor api"   # save to file
prompt-builder --print-skills-only "design card"  # matched skills only

# Discovery
prompt-builder --list-modes
prompt-builder --list-stacks

# Validate a generated prompt file
prompt-builder --validate prompt.txt
```

### Library

```js
const { generatePrompt, platformDetector, modeRouter, skillMatcher } = require('@vaqif14/prompt-builder');

// Generate prompt
const result = generatePrompt("design auction card", { mode: 'design-review' });
console.log(result.prompt);
console.log(result.metadata.platforms);   // ['web']
console.log(result.metadata.mode);        // 'design-review'
console.log(result.validation.score);     // 90

// Platform detection
const platforms = platformDetector.detectPlatformsMixed("ios app with backend api");
// ['ios', 'backend', 'integration']

// Mode inference
const mode = modeRouter.inferMode("review admin dashboard"); // 'audit'

// Skill matching
const analysis = skillMatcher.analyzeTask("fix login bug");
// { domains: [...], complexity: 'Low', agentCount: 3 }
```

### Example Prompts

```bash
# Frontend
prompt-builder "design auction countdown timer with live updates"

# Backend
prompt-builder --mode audit "check Spring Boot auth vulnerabilities"

# Mobile
prompt-builder --platform ios "review SwiftUI checkout screen"
prompt-builder --platform android "fix Kotlin Compose login flow"

# AI/ML
prompt-builder --mode audit "audit RAG agent app memory persistence"

# Mixed platform
prompt-builder "build mobile app with backend API"
```

### How It Works

1. **You ask** — Request any task (build, review, fix, refactor, audit)
2. **Platform detected** — Auto-detects platform(s) from task text
3. **Mode routed** — Classifies into one of 10 modes
4. **Skills matched** — Maps domains to skills and builds agent council
5. **Task board built** — Creates multica-style task cards with dependencies
6. **Prompt assembled** — Generates 14-section professional prompt
7. **Validated** — Scores quality with Validation V2 (100 pts)

---

## Agent Harness Architecture

Prompt Builder includes a **7-layer agent harness** for autonomous execution:

| Layer | Script | Purpose |
|-------|--------|---------|
| **Tool Registry** | `scripts/tool-registry.js` | Catalog of built-in + skill-based tools |
| **Policy Engine** | `scripts/policy-engine.js` | PreToolUse hooks: scope gate, permissions |
| **State Manager** | `scripts/state-manager.js` | Session persistence to `memory/<session>.json` |
| **Error Handler** | `scripts/error-handler.js` | Structured errors: transient/permission/validation/internal |
| **Orchestration** | `scripts/harness.js` | Main engine with PreToolUse → Execute → PostToolUse |
| **Safety Monitor** | `scripts/safety-monitor.js` | Circuit breaker, iteration limit, file limit |
| **Output Normalize** | `scripts/harness.js` | PostToolUse: reshape, optimize, update state |

```bash
# Demo the harness
node scripts/harness.js
```

---

## Architecture & Contributing

### For Users

Always use the latest version from npm:

```bash
npx @vaqif14/prompt-builder@latest "your task here"
```

### For Contributors

```bash
# 1. Clone the repository
git clone https://github.com/vaqif14/claude-prompt-builder.git
cd claude-prompt-builder

# 2. Understand the structure
src/                         # Core modules
  platform-detector.js       # 18-platform detection + mixed lanes
  mode-router.js             # 10-mode inference + mode configs
  skill-matcher.js           # Skill mapping, agent council, task board
  prompt-assembler.js        # Prompt generation and assembly
bin/                         # CLI entry point
scripts/                     # Agent harness + utilities
data/                        # Templates, stacks, patterns, agents
tests/                       # Test suite

# 3. Run tests
npm test

# 4. Create PR
git checkout -b feat/your-feature
git commit -m "feat: description"
git push -u origin feat/your-feature
```

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vaqif14/claude-prompt-builder&type=Date)](https://star-history.com/#vaqif14/claude-prompt-builder&Date)

---

## License

This project is licensed under the [MIT License](LICENSE).
