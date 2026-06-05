---
name: prompt-builder
description: Build professional, paste-ready orchestration prompts for coding agents. Use when the user asks for prompt-builder, expert prompt, agent task brief, codebase audit prompt, dashboard review prompt, or wants a vague request turned into a prompt that first discovers relevant local and ecosystem skills, recommends installing/loading better skills, then tells the next agent which skills to invoke, in what order, with what evidence.
---

# Prompt Builder

## Core Rule

Turn vague user requests into precise, paste-ready orchestration prompts. A professional prompt must define role, mission, target surface, skill discovery preflight, required skills to invoke, agent review passes, allowed tools, stop conditions, verification gates, and output format.

Prompt Builder does not *implement* the change (it does not edit files or ship the fix). But it MUST do the understanding: read the target code, diagnose the actual problem, and write the concrete solution direction into the prompt ("the root cause is X at `file:line`; the fix is to change A→B / extract Y / split Z"). It is a *diagnosis-and-prescription* tool, not just a routing manifest — a prompt that only says "go find the problem and figure out the fix" has failed. It then also prepares the orchestration around that solution: which skills to discover/install/call, in what order, with what evidence. For review requests, require evidence first and never let the prompt claim success upfront.

## How It Works: Understand → Clarify → Conclude

This is the heart of the skill. The user speaks in **plain, natural language** — in any
language, however casual or vague (`"yoxla bu səhifəni"`, `"bunu düzəlt"`, `"add a timer"`).
The skill does the work of understanding it **against the real codebase**, not just the words:

1. **Understand the request in plain language.** Accept casual, mixed-language, or
   underspecified input. Never demand precise phrasing from the user.
2. **Ground it in the codebase.** Before writing the prompt, read the repo: find the actual
   route / component / service / file the request is about, the conventions already in use,
   and the surrounding code. Map the vague intent to concrete `file:line` targets. The CLI
   heuristics (mode, platform, stack, skills) are a starting point — the codebase is the
   source of truth.
3. **Clarify only when genuinely blocked.** If — *after reading the code* — the target,
   scope, or intended outcome is still ambiguous in a way that changes what gets built, ask
   the user **one focused question and wait**. Do not guess on decisions the user owns. If
   the code already makes the intent clear, proceed without asking.
4. **Diagnose and write the solution.** This is the step that separates a useful prompt from
   orchestration ceremony. Open the resolved target file(s) and actually read them. Then fill
   the `PROBLEM ANALYSIS & SOLUTION DIRECTION` section with a concrete, code-grounded diagnosis:
   the root cause at a real `path:line`, why it matters *in this code*, and the specific fix to
   apply ("extract `X` from `file:line`", "split this 700-line god-class into A/B/C", "fix the
   N+1 at `line` with a JOIN FETCH", "change `A` → `B`"). The prompt must carry the *solution
   direction*, not just a map and a "go figure it out".
5. **Conclude with the prompt.** Once targets are resolved and the diagnosis is written, emit
   the orchestration prompt (sections below) — never a generic, placeholder prompt.

**Hard gate (Conclude):** the CLI scaffold is an *intermediate* artifact (its own summary prints
`Solution: DRAFT` until you fill it). Do NOT hand the prompt back while it is a draft:

- Resolve every `GROUNDING CONTRACT` slot and the `<RESOLVE …>` markers to concrete `file:line`
  targets you found by reading the repo. If the named entry point is a redirect / barrel /
  re-export, resolve to the true implementation first (e.g. a `page.tsx` that just `redirect()`s).
- **Fill `PROBLEM ANALYSIS & SOLUTION DIRECTION` from code you actually read** — a real root
  cause + a named, specific fix. A prompt whose PROBLEM ANALYSIS still contains `<RESOLVE …>`, or
  that substitutes generic verbs ("identify the smell", "map the structure") for a real finding,
  is **unfinished — do not emit it**.
- Detect the package manager / build tool from the lockfile and state the real verification commands.

Goal: the user explains normally; the skill reads the code, names the actual problem and its fix,
and hands back a ready, solution-grounded prompt — not a routing manifest.

## Quick Start

```bash
# Default — mode and platform auto-detected
node bin/prompt-builder.js "review admin dashboard and confirm that all working"

# Explicit mode
node bin/prompt-builder.js --mode design-review "review checkout screen"
node bin/prompt-builder.js --mode security-review "audit auth flow"
node bin/prompt-builder.js --mode performance-review "why is this slow"

# Platform override
node bin/prompt-builder.js --platform ios "review login screen"

# Stack profile cache
node bin/prompt-builder.js --init-stack-profile --stack nextjs
node bin/prompt-builder.js --refresh-stack-profile "review admin dashboard"
node bin/prompt-builder.js --no-stack-cache "one-off prompt"

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

Ask at most one clarifying question, and only after reading the codebase fails to resolve the target surface or intended outcome. If the user names a page, route, module, or file — or the repo makes it obvious — proceed without asking.

## Professional Prompt Shape

Generate these sections in order:

1. **System Contract**: senior role, exact mission, authority level
2. **Context Window**: stack, known project constraints, target paths if known
3. **Skill Discovery Preflight**: local skill scan + ecosystem search + install/load recommendation format
4. **Matched Skills**: only skills that directly improve the task
5. **Required Skills To Invoke**: exact skill names, reasons, and execution order
6. **Agent Review Council**: role-based passes such as designer, UI architect, frontend reviewer, browser QA, verification
7. **Multi-Agent Task Board**: task cards with id | owner | skill | title | status | depends_on | artifact
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

1. Check `.prompt-builder/stack-profiles/<stack>.md` first.
2. If the MD exists, read it and do not repeat broad local/ecosystem skill discovery.
3. If the MD is missing, generate it from bundled stack intelligence, installed skill metadata, required skills, missing skills, and refresh queries.
4. Search installed skill metadata under `.claude/skills`, `.codex/skills`, `.agents/skills`, and global user skill folders only when no fresh stack profile exists or refresh is requested.
5. Invoke `find-skills` when available and the stack profile says a stronger skill is needed.
6. If network/tooling is available and refresh is requested, search the open ecosystem with `npx skills find "<task keywords>"`. When a skill is not installed locally, research it on the internet **only from trusted sources** — the npm registry, GitHub (repos/topics with a clear `SKILL.md`, stars, recent commits), and curated ecosystem signals on x.com from reputable authors. Never pull a skill from anonymous gists, pastebins, or unvetted low-signal sources.
7. Verify quality before recommending: trusted source (above), task fit, source reputation, install count, clear `SKILL.md`, and direct workflow value.
8. If a better skill is found, recommend:
   - `npx skills add <package> -g -y`
   - `/reload-skills`
   - the exact prompt command to rerun with that skill.
9. If no better skill exists or installation is not approved, continue with the best installed skills and state that discovery found no stronger option.

## Stack Profile Cache

Version 1.5.1 adds a project-local cache so prompt generation does not spend tokens repeating the same stack/skill discovery on every run.

Default CLI behavior:

- Detect stack/platform from the task and optional `--stack`, `--platform`, `--backend`, or `--database` flags.
- Look for `.prompt-builder/stack-profiles/<stack>.md`.
- If the MD exists, mark cache `HIT`, tell the next agent to read it, and skip broad skill search.
- If the MD is missing, create it before building the prompt.
- The MD includes stack context, best practices, anti-patterns, verification gates, required skills, installed skill matches, missing approval-required skills, and ecosystem refresh queries.
- Use `--refresh-stack-profile` when stack/tooling changes.
- Use `--no-stack-cache` only when a one-off prompt should ignore project cache.

Skill installation rule: generated MD files may include commands such as `npx skills add <skill> -g -y`, but they are recommendations only. The acting agent must ask the user before running any install command.

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

When the task mentions an admin dashboard, the generated prompt tells the next agent to
**discover the real targets in the repo it is working in** (do not assume a fixed layout):

- the admin/dashboard route (e.g. an `(admin)` route group or a dashboard page component)
- the dashboard data layer: list/query hooks and the API client feeding the widgets
- the shared UI primitives the dashboard composes (tables, cards, charts)
- the i18n/translation catalogs, if the app is localized
- any project UI/style-contract or design-system doc to judge against

Candidate skills (confirm availability via `find-skills`; names may differ across registries):

- `find-skills` for local + ecosystem skill discovery
- `enterprise-ui-architect` for admin dashboard structure and component-library quality
- `ui-ux-pro-max` for visual/style-contract review
- `emil-design-eng` for micro-polish and designer-eye critique
- `frontend-patterns` for component architecture
- `browser-qa` for runtime UI verification
- `verification-loop` for build/type/lint/test gates

## Multi-Agent Orchestration

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

## Next Steps

- **Need a fast lookup?** → See [QUICKREF.md](./QUICKREF.md) for flags tables, script maps, and validation scoring.
- **Need deep theory, templates, and extension points?** → See [REFERENCE.md](./REFERENCE.md) for CCAP patterns, agent orchestration mechanics, and checklists.
