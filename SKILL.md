---
name: prompt-builder
description: Build professional, paste-ready orchestration prompts for coding agents. Use when the user asks for prompt-builder, expert prompt, agent task brief, codebase audit prompt, dashboard review prompt, or wants a vague request turned into a prompt that first discovers relevant local and ecosystem skills, recommends installing/loading better skills, then tells the next agent which skills to invoke, in what order, with what evidence.
---

# Prompt Builder

## Core Rule

Turn vague user requests into precise, paste-ready orchestration prompts. A professional prompt must define role, mission, target surface, skill discovery preflight, required skills to invoke, agent review passes, allowed tools, stop conditions, verification gates, and output format.

Prompt Builder does not do the requested engineering/design work itself. It prepares the next-agent prompt that says which skills to discover, install/load if needed, call, and how to use their outputs. For review requests, require evidence first and never let the prompt claim success upfront.

## Intent Routing

Classify the task before writing the prompt:

- `review`, `audit`, `check`, `confirm`, `verify`, `qa`, `all working`, `yoxla`, `təsdiq` -> audit prompt
- `fix`, `bug`, `error`, `broken`, `fail`, `xəta`, `səhv` -> diagnosis/bugfix prompt
- `refactor`, `rewrite`, `modernize`, `clean` -> refactor prompt
- `design review`, `visual review`, `does this look good` -> design-review prompt
- `architecture review`, `is this well structured`, `hexagonal` -> architecture-review prompt
- `security review`, `is this secure`, `cve` -> security-review prompt
- `performance review`, `why is this slow`, `optimize` -> performance-review prompt
- `release`, `deploy`, `ready to ship` -> release-check prompt
- `prd`, `spec`, `break into tasks` -> prd-to-tasks prompt
- otherwise -> feature/execution prompt

Ask at most one clarifying question only when the target surface cannot be inferred. If the user names a page, route, module, or file, proceed.

## Professional Prompt Shape

Generate these sections in order:

1. **System Contract**: senior role, exact mission, authority level
2. **Context Window**: stack, known project constraints, target paths if known
3. **Skill Discovery Preflight**: local skill scan + ecosystem search + install/load recommendation format
4. **Matched Skills**: only skills that directly improve the task
5. **Required Skills To Invoke**: exact skill names, reasons, and execution order
6. **Agent Review Council**: role-based passes such as designer, UI architect, frontend reviewer, browser QA, verification
7. **Multica-Style Task Board**: task cards with id | owner | title | status | depends_on | artifact
8. **Execution Plan**: checkbox tasks, first task active
9. **Tool Directives**: read/write/execute/browser permissions and forbidden actions
10. **Constraints**: scope fences and stop-and-ask triggers
11. **Stop Conditions**: when to escalate or halt
12. **Acceptance Criteria**: measurable gates, not vague quality statements
13. **Evidence Gates**: every claim must be backed by file:line, screenshot, command output, or log
14. **Output Format**: exact report shape expected from the coding agent

The generated prompt must include these rules:

- Do not continue until relevant skills are invoked or marked unavailable with a reason.
- Do not claim a skill was used unless its guidance was loaded/read or workflow was followed.
- Do not rely only on the hardcoded skill list. First search local installed skills and, when available, the open skill ecosystem.
- If a stronger skill exists, recommend the install/load command and exact rerun prompt after `/reload-skills`.
- Report which finding came from which skill or review pass.

## Skill Discovery Preflight

Every generated prompt should require the next agent to:

1. Search installed skill metadata under `.claude/skills`, `.codex/skills`, `.agents/skills`, and global user skill folders.
2. Invoke `find-skills` when available.
3. If network/tooling is available, search the open ecosystem with `npx skills find "<task keywords>"`.
4. Verify quality before recommending: task fit, source reputation, install count, clear `SKILL.md`, and direct workflow value.
5. If a better skill is found, recommend:
   - `npx skills add <package> -g -y`
   - `/reload-skills`
   - the exact prompt command to rerun with that skill.
6. If no better skill exists or installation is not approved, continue with the best installed skills and state that discovery found no stronger option.

## Universal Platform Coverage

The generated prompt must work for any software surface:

- **Web/frontend**: React, Next.js, Vue, Svelte, Angular, dashboards, landing pages
- **Backend/API**: Spring Boot, Node, FastAPI, Django, Go, Rust, .NET, services, databases
- **iOS**: Swift, SwiftUI, UIKit, Xcode, Simulator
- **Android**: Kotlin, Java, Jetpack Compose, Gradle, emulator
- **Cross-platform mobile**: Flutter/Dart, React Native/Expo
- **Desktop**: Electron, Tauri, native apps
- **CLI/tooling**: command UX, flags, exit codes, fixtures
- **AI apps**: OpenAI/LLM/RAG/agents/evals/persistence
- **DevOps**: CI/CD, Docker, Vercel, deployments, rollback
- **Game dev**: Unity, Unreal, Godot
- **Data/ML**: pipelines, PyTorch, TensorFlow, pandas, notebooks

For every prompt, detect platforms from the task text and include a platform profile with signals, default skills, expected verification evidence, and platform-specific agents. Mixed-platform tasks get separate agent lanes plus an integration lane.

## Audit / Review Prompts

For requests like `review admin dashboard and confirm that all working`, generate a read-only, evidence-based QA prompt.

Mandatory behavior:

- Treat `confirm all working` as a verification task, not a promise.
- Require the next agent to invoke relevant skills before judging the page.
- Require source inspection plus runtime checks when possible.
- Require browser QA for UI routes when a dev server is available.
- Require command evidence: lint/typecheck/build/tests attempted, with pass/fail.
- Require console and network evidence: no unexplained critical errors.
- Require a final verdict: `Working`, `Working with issues`, `Blocked`, or `Not working`.
- For UI/dashboard reviews, require a designer-eye verdict. A page can be technically working but still be `Working with design issues`.
- If auth, credentials, backend, browser permissions, or dev server block verification, report `Blocked` with the exact blocker.

Never allow an audit prompt to modify files unless the user explicitly asks for fixes after the audit.

## Admin Dashboard Special Case

When the task mentions admin dashboard, include these project-aware targets when relevant:

- `frontend/src/app/[locale]/(admin)/admin/page.tsx`
- `frontend/src/features/admin/components/dashboard/`
- `frontend/src/features/admin/hooks/useAdminDashboard.ts`
- `frontend/src/features/admin/hooks/useAdminAnalytics.ts`
- `frontend/src/features/admin/services/admin-client.ts`
- `frontend/messages/az.json`, `frontend/messages/en.json`, `frontend/messages/ru.json`
- `docs/reference/frontend-ui-style-contract.md`

Matched skills should usually include:

- `find-skills` for local + ecosystem skill discovery
- `enterprise-ui-architect` for admin dashboard structure and MUI quality
- `ui-ux-pro-max` for visual/style-contract review
- `emil-design-eng` for micro-polish and designer-eye critique
- `frontend-patterns` for Next.js/component architecture
- `browser-qa` for runtime UI verification
- `verification-loop` for build/type/lint/test gates

## CLI

Use the bundled generator when the user wants command output:

```bash
# Default (auto-detect mode)
node bin/prompt-builder.js "review admin dashboard and confirm that all working"

# Explicit mode
node bin/prompt-builder.js --mode design-review "review checkout screen"
node bin/prompt-builder.js --mode security-review "audit auth flow"
node bin/prompt-builder.js --mode performance-review "why is this slow"

# Platform override
node bin/prompt-builder.js --platform ios "review login screen"

# Output formats
node bin/prompt-builder.js --compact "add timer"           # minimal
node bin/prompt-builder.js --json "fix bug"                 # JSON
node bin/prompt-builder.js --save prompt.txt "refactor api" # save to file
node bin/prompt-builder.js --print-skills-only "design card" # skills only

# Lists
node bin/prompt-builder.js --list-modes
node bin/prompt-builder.js --list-stacks

# Validate a generated prompt file
node scripts/validate.js prompt.txt
```

## Multica-Style Orchestration

Use a managed-agent task-board style:

- Coordinator/Tech Lead creates the task graph
- Skill Scout discovers local/ecosystem skills first
- Specialized agents own platform-specific task cards
- QA/Verification agent collects runtime and command evidence
- Coordinator synthesizes findings and resolves conflicts

Every generated prompt should include:

- task cards with `id | owner | title | status | depends_on | artifact`
- parallelization rules
- conflict ownership rules
- handoff artifact rules
- final synthesis rules

## Modes Reference

| Mode | Trigger Keywords | Authority |
|---|---|---|
| `feature` | add, implement, create, build | Autonomous execution |
| `audit` | review, check, verify, yoxla | Read-only audit |
| `bugfix` | fix, bug, error, xəta | Diagnose and fix |
| `refactor` | refactor, clean, modernize | Refactor safely |
| `design-review` | design review, visual audit | Read-only design audit |
| `architecture-review` | architecture, hexagonal, structure | Read-only architecture audit |
| `security-review` | security, cve, vulnerability | Read-only security audit |
| `performance-review` | slow, optimize, profile | Performance audit |
| `release-check` | release, deploy, ship | Release readiness |
| `prd-to-tasks` | prd, spec, break into tasks | PRD decomposition |

Use `REFERENCE.md` only when deeper prompt theory or template examples are needed.
