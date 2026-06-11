---
name: prompt-builder
description: Build professional, paste-ready orchestration prompts for coding agents. Use when the user asks for prompt-builder, expert prompt, agent task brief, codebase audit prompt, dashboard review prompt, or wants a vague request turned into a prompt that first discovers relevant local and ecosystem skills, recommends installing/loading better skills, then tells the next agent which skills to invoke, in what order, with what evidence.
---

# Prompt Builder

## Core Rule

Turn vague user requests into precise, paste-ready orchestration prompts. A professional prompt must define role, mission, target surface, skill discovery preflight, required skills to invoke, agent review passes, allowed tools, stop conditions, verification gates, and output format.

Prompt Builder does not *implement* the change (it does not edit files or ship the fix). But it MUST do the understanding: read the target code, diagnose the actual problem, and write the concrete solution direction into the prompt ("the root cause is X at `file:line`; the fix is to change A→B / extract Y / split Z"). It is a *diagnosis-and-prescription* tool, not just a routing manifest — a prompt that only says "go find the problem and figure out the fix" has failed. It then also prepares the orchestration around that solution: which skills to discover/install/call, in what order, with what evidence. For review requests, require evidence first and never let the prompt claim success upfront.

## How It Works: Understand → Clarify → Discover → Diagnose → Conclude

This is the heart of the skill. The user speaks in **plain, natural language** — in any
language, however casual or vague (`"yoxla bu səhifəni"`, `"bunu düzəlt"`, `"add a timer"`).
The skill does the work of understanding it **against the real codebase**, not just the words.
Each gate has a pass condition; a gate with no work to do is omitted (no ceremony):

1. **Understand the request in plain language.** Accept casual, mixed-language, or
   underspecified input. Never demand precise phrasing from the user.
2. **Ground it in the codebase.** Before writing the prompt, read the repo: find the actual
   route / component / service / file the request is about, the conventions already in use,
   and the surrounding code. Map the vague intent to concrete `file:line` targets. The CLI
   heuristics (mode, platform, stack, skills) are a starting point — the codebase is the
   source of truth.
3. **Clarify only when genuinely blocked (CLARIFY-FIRST GATE).** This gate is emitted **only when
   grounding confidence is low** — the task named no surface and several plausible ones exist. It
   poses **exactly one** A/B/C question naming the real candidate paths; the agent asks it and
   **waits**, then records `Resolved target:` and deletes the question. High confidence → the gate
   is omitted entirely.
4. **Discover skills (SKILL SUGGESTIONS gate).** Check what is installed vs. what the ecosystem
   offers (`npx skills find`, best-effort/offline-degrading). Every matched skill is labeled
   ✓ installed / ⤓ suggested / ? unverified; not-installed best-fits become an install suggestion +
   rerun (never "load first"). Settle install decisions **before** the diagnosis pass uses them.
5. **Diagnose and write the solution.** This is the step that separates a useful prompt from
   orchestration ceremony. Open the resolved target file(s) and actually read them. Then fill
   the `PROBLEM ANALYSIS & SOLUTION DIRECTION` section with a concrete, code-grounded diagnosis:
   the root cause at a real `path:line`, why it matters *in this code*, and the specific fix to
   apply ("extract `X` from `file:line`", "split this 700-line god-class into A/B/C", "fix the
   N+1 at `line` with a JOIN FETCH", "change `A` → `B`"). The prompt must carry the *solution
   direction*, not just a map and a "go figure it out".
6. **Conclude with the prompt.** Once targets are resolved and the diagnosis is written, emit
   the orchestration prompt (sections below) — never a generic, placeholder prompt. The CLI refuses
   to `--save` a prompt that still has unfilled `<RESOLVE>` markers (`validation.blockingMarkers`
   names each with its section + line); use `--save-draft` to override.

**Hard gate (Conclude):** the CLI scaffold is an *intermediate* artifact (its own summary prints
`Solution: DRAFT` and `Plan: DRAFT` until you fill them). Do NOT hand the prompt back while it is a draft:

- Resolve every `GROUNDING CONTRACT` slot and the RESOLVE markers to concrete `file:line`
  targets you found by reading the repo. If the named entry point is a redirect / barrel /
  re-export, resolve to the true implementation first (e.g. a `page.tsx` that just `redirect()`s).
- **Fill `PROBLEM ANALYSIS & SOLUTION DIRECTION` from code you actually read** — a real root
  cause + a named, specific fix. A prompt whose PROBLEM ANALYSIS still contains a RESOLVE marker, or
  that substitutes generic verbs ("identify the smell", "map the structure") for a real finding,
  is **unfinished — do not emit it**.
- **Fill the `TASK PLAN` with real, file-path'd, acceptance-bearing tasks derived from the code you
  read** — each task names a concrete `file:line`, its dependencies, and an observable acceptance
  (Given/When/Then or a named test); read-only modes fill a findings ledger with evidence instead.
  A plan of generic verbs ("apply refactor in small steps") or unfilled RESOLVE rows is unfinished.
  This is what lets the user act without navigating the codebase themselves — it is the deliverable.
- Detect the package manager / build tool from the lockfile and state the real verification commands.

Goal: the user explains normally; the skill reads the code, names the actual problem and its fix,
writes the detailed file-path'd task plan, and hands back a ready, solution-grounded prompt the user
can act on without opening the codebase — not a routing manifest.

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

# Model / sessions / token budget
node bin/prompt-builder.js --model opus "refactor api"      # force model for all agents (haiku|sonnet|opus)
node bin/prompt-builder.js --session-id <id> "continue"     # resume a prior session
node bin/prompt-builder.js --list-sessions                  # show recent sessions
node bin/prompt-builder.js --max-tokens 8000 "big task"     # token budget (default 6000)
node bin/prompt-builder.js --full "big task"                # disable token compression (emit every section)
node bin/prompt-builder.js --context-report "task"          # print per-section token usage

# Lists
node bin/prompt-builder.js --list-modes
node bin/prompt-builder.js --list-stacks

# Validate a generated prompt file
node scripts/validate.js prompt.txt
```

**Grounding requires the target repo as cwd.** The codebase-grounding engine (Grounded Targets,
real build commands, ranked targets, invariants) only runs against `process.cwd()`. Run the CLI
**from the root of the project being worked on** — do NOT `cd` into the skill directory first. If
cwd is wrong, the prompt silently grounds in the wrong repo and falls back to the generic
(ungrounded) Grounding Contract. Token-compression note: the default 6000-token budget can elide
lower-priority sections; use `--full` when you need the complete prompt, or `--max-tokens` to widen it.

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

The CLI emits these sections in this order (this is the real v1.9.0 output, not an idealized list).
The five **bolded** sections are the differentiator — a generic prompt builder has none of them.
The CLI emits them with `<RESOLVE>` slots; the SKILL fills the two marked ⬅ from code it actually reads.

1. **System Contract**: senior role, exact mission, authority level
2. **Workflow Pattern**: the composable agent shape to run (single-pass / prompt-chain / routing / parallel-review / orchestrator-workers / evaluator-optimizer / autonomous-loop) with a one-line shape + rationale — simple/composable before autonomous
3. **Grounded Targets**: auto-detected from the repo — detected stack, real build/test commands, ranked target files, project invariants (only when run with the target repo as cwd; see grounding note below)
4. **Grounding Contract**: surface-aware slots (entry point, data layer, contracts, schema…) to resolve to real `file:line` before executing
5. **Problem Analysis & Solution Direction** ⬅ *the diagnostic center* — root cause at `path:line`, why it matters in THIS code, the specific fix. SKILL fills this; an unfilled one = `solutionReadiness: draft`
6. **Write Safety Gate** (write modes only): plan-approval gate + invariant fence; takes precedence over the plan
7. **Context Window**: stack profile, detected platform profile, target-surface hints, user profile
8. **Skill Discovery Preflight**: stack-profile-cache-first local scan + ecosystem search + install/load recommendation format
9. **Selective Install Profile** (only with `--profile`): a small, capped (≤6), approval-required curated skill set for the project shape
10. **Matched Skills** + **Required Skills To Invoke**: exact skill names, reasons, execution order
11. **Multi-Agent Task Board**: task cards `id | owner | skill | title | status | depends_on | artifact` + skill-binding rule
12. **Agent Review Council** (+ **Designer Rubric** for visual surfaces): role-based passes
13. **Model Assignments**: complexity → model per agent
14. **Task Plan** ⬅ spec-kit-style rows (`T###` edit tasks with `file:line` + acceptance + `depends_on`; read-only modes emit an `F###` findings ledger with evidence). SKILL fills this; an unfilled one = `planReadiness: draft`
15. **Tool Directives**: read/write/execute/browser permissions and forbidden actions
16. **Constraints** (+ scope fences and stop-and-ask triggers)
17. **Stack Best Practices / Anti-Patterns / Verification Gates** (+ **Stop Conditions**)
18. **Verification Contract**: every claim split by the proof that backs it — provable-by-source / -command / -browser-device / blocked-by — so "Blocked" is first-class and nothing is claimed without proof
19. **Acceptance Criteria** + **Evidence Gates**: every claim backed by `file:line`, screenshot, command output, or log
20. **Output Schema**: exact report shape expected from the coding agent

**Context diet.** Every run scores the prompt for context pressure (`lean`/`ok`/`heavy`), flags
oversized sections and missing stack-profile caching, and recommends a `--max-tokens`. Surfaced in
`metadata.contextDiet`, `--context-report`, and the CLI metadata card — context overload is the main
agent failure mode, so the builder measures it.

**Quality bar (dev-metrics aligned).** The generated prompt is engineered to make the resulting
session score 9–10 on the six dimensions the `dev-metrics` `session-scorer` rates: `prompt_quality`,
`context_provision`, `response_quality`, `task_clarity`, `verification_rigor`, `tool_utilization`.
A compact **Quality Bar** section (near the top) states the bar and calls out the org's weak spots —
**verification rigor** and **tool use**. The rubric is enforced by construction: PROBLEM ANALYSIS
carries expected-vs-actual / hypothesis / what-was-tried; CONTEXT WINDOW carries
why-it-matters / related-systems / environment / which-tests; the spec block carries edge cases +
non-goals; the VERIFICATION CONTRACT carries the rubric-10 rigor checklist (read diffs, re-run the
full suite, check side-effects, validate every file ref, hunt silent failures). `metadata.qualityRubric`
self-reports how many dimensions the prompt covers and which to fill.

**Two-axis readiness (the hard gate).** `validate.js` reports a scaffold score (0–100) AND two
orthogonal readiness flags. `solutionReadiness` is `ready` only when section 4 has no `<RESOLVE>`
left and contains a real `path:line` token. `planReadiness` is `ready` only when section 12 is
likewise filled. Overall `readiness` is `ready` only when BOTH are. A 100/100 scaffold with an
unfilled diagnostic center is a DRAFT — do not hand it off.

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

A project-local cache lets prompt generation skip repeating the same stack/skill discovery on every run.

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
| `hackathon` | hackathon, mvp, demo, pitch, judging | Domain-first narrow MVP + demo proof |
| `agent-readiness` | .claude, CLAUDE.md, skills/hooks/mcp audit | Read-only `.claude` portfolio audit |
| `tooling-review` | mcp readiness, tool overload, integration audit | Read-only MCP/CLI tool & auth audit |
| `skill-review` | skill review, skill bloat, SKILL.md | Read-only agent-skill quality review |

## Next Steps

- **Need a fast lookup?** → See [QUICKREF.md](./QUICKREF.md) for flags tables, script maps, and validation scoring.
- **Need deep theory, templates, and extension points?** → See [REFERENCE.md](./REFERENCE.md) for CCAP patterns, agent orchestration mechanics, and checklists.
