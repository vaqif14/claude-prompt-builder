# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-06-05

Codebase-grounding release. The criticism: "the prompt is still generic — any ChatGPT prompt
builder does this; it must be grounded in the actual codebase." Adversarial review of the
generic output scored 58/100. This release makes the CLI actually read the target repo, and the
grounded output re-scored with the "too generic" criticism resolved.

### Added

- **`src/codebase-grounding.js`** — when a real repo path is given (the CLI passes `cwd`), the
  generator now READS the repo and injects a **GROUNDED TARGETS** section with concrete facts:
  - **Real target files** matched to the task tokens (e.g. `(bidder)/products/page.tsx` flagged as
    a redirect stub → resolve to `(bidder)/auctions/page.tsx`); for token-less tasks (e.g. "fix code
    quality") it falls back to the largest/most-complex files **ranked by lines of code** (the real
    god-classes — e.g. `AdminController.java` 1131 lines — not "scan these source roots").
  - **Detected stack with versions** from package.json + build.gradle (Next.js 16.2.6, MUI 7.3.6,
    Spring Boot, Spring Security, LDAP, Flyway, Java 17 …) instead of "component library of choice".
  - **Real build/test/lint commands** detected from the lockfile/build file, surface-preference
    aware (a frontend task gets `pnpm typecheck/lint/test`; a backend task gets `./gradlew …`).
  - **Project invariants** quoted from CLAUDE.md/AGENTS.md (bid row locking, idempotency,
    timer/leader rules, append-only audit), with wrapped multi-line rules joined (no truncation).

### Fixed

- GROUNDING CONTRACT no longer claims "NOT yet grounded" when concrete targets were detected;
  it references GROUNDED TARGETS and lists only what still needs resolving.
- Trimmed redundancy flagged in review: merged the duplicate "Required Skills" + "Skill Execution
  Order" lists into one, dropped the Universal Agent Roster (duplicate of the task board), and cut
  the skill-discovery queries from 8 to 5. Default budget raised to 5500 for the richer grounded
  brief; validator length ceiling widened accordingly.

## [1.6.0] - 2026-06-05

Platform-awareness release. An adversarial agent review of a backend code-quality prompt
scored the prior output 38/100 — frontend-biased throughout, skills bound by array position,
write-safety missing. This release rebuilds those paths to be surface-aware and re-scored 91/100.

### Added

- **Surface-aware GROUNDING CONTRACT**: backend/service tasks get service slots (public API/DTO
  contract, controller→service→repository call graph, transaction boundaries, domain invariants);
  data tasks get schema/migrations/query-plan slots; UI tasks keep route/component/design-token/i18n
  slots. No more design-tokens/i18n grounding handed to a Java backend.
- **Task-fit skill binding** (`pickPrimarySkill`): refactor/architecture/audit/perf tasks bind the
  patterns/review skill (e.g. springboot-patterns), not the positional-first api-design; the skill
  execution order leads with it. Secondary skills are now **demand-driven** ("invoke only if the
  grounding step finds work it covers; else N/A") instead of blanket-mandatory.
- **Platform-aware Agent Review Council**: service surfaces get a Backend/Service Code Reviewer
  (services/repos/transactions/error handling), not a Frontend reviewer hunting i18n keys.
- **WRITE SAFETY GATE** (write modes), hoisted above the Execution Plan: a Plan-Approval Gate
  (present the change list and wait for approval before editing) and an Invariant Fence
  (characterize concurrency/locking, idempotency, money/time, auth, append-only/audit data, and
  applied migrations before changing; never weaken them) — with explicit "never fabricate metrics".

### Fixed

- Evidence verdict is surface-aware: UI = renders with real data (screenshot); service/data = proven
  by passing tests + logs/traces/query output. "screenshot" and "dev server" no longer demanded of
  backend tasks.
- The skill-invocation list and agent review council are now protected from token-budget elision
  (MATCHED SKILLS → priority 0, council → priority 1); default budget 3500→4500 so the full
  comprehensive prompt survives. Validator now checks the skill-invocation list + agent→skill
  binding actually survived (no more 100/100 with skills silently elided).
- Removed refactor-template legacy checkboxes that invited fabricated metrics / phantom API
  deprecations / test-gaming; reconciled "no perf regression" with sanctioned N+1 fixes.
- spring-boot stack profile no longer asserts JWT/OAuth2 auth or Testcontainers as fact (hedged
  per project — corp-auction is LDAP/sessions); Flyway noted forward-only.
- Renamed the user-facing "MULTICA-STYLE TASK BOARD" → "MULTI-AGENT TASK BOARD".

## [1.5.6] - 2026-06-05

Real-world test (backend code-quality task) surfaced routing/scoring gaps; closed them.

### Fixed

- **Quality-vs-bug routing**: "fix the code quality / best-practice deviations" now routes to
  `refactor`, not `bugfix`. The bare word "fix" no longer forces bugfix when the task is a
  quality/best-practice/smell/tech-debt/cleanup sweep — unless there is an acute-bug signal
  (broken / crash / throws / failing / exception). Whole-stack.
- **Complexity underestimation**: a single-domain refactor / security / performance / migration
  task is no longer scored `Low` (which selected Haiku). Depth signals lift it to at least
  `Medium` → Sonnet, so quality work does not get the cheapest model.
- **Validator multi-word stack bug**: the stack-specific-discovery check used `[a-z-]+`, which
  rejected spaces, so multi-word stacks ("spring boot best practices", "ruby rails", "react
  native") failed the check and scored 95 instead of 100. Now allows spaces.

## [1.5.5] - 2026-06-05

Real-world test (bidder product-list audit) surfaced gaps; this release closes them.

### Fixed

- **Platform detection word boundaries**: `detectPlatforms` (the 22-entry PLATFORM_REGISTRY)
  still used substring matching — `main page`→`ai` (ai⊂main), `rusty`→`rust`, `retail`→`ai`.
  Now every platform keyword is `\b`-bounded (matches the earlier `detectStack` fix). Whole-stack.
- **Platform signals no longer leak regex source** into the prompt; `signals=` is now a clean
  human keyword list instead of `\b(?:web|frontend|...)\b`.
- **Mode routing for visual audits**: "visual design audit" / "audit the ui design" now route to
  `design-review` (co-occurrence matching) instead of generic `audit`.
- **Token budget no longer elides the mode-defining section**: priority is mode-aware — a
  design-review keeps its Designer Rubric + Agent Review Council; skill-discovery is always kept.
  Default budget raised 3000→3500 to fit the richer prompt.
- Read-only review modes label their task cards "review pass", not "implementation pass".

### Added

- **Agent → skill binding**: every task-board card and roster agent now names the specific skill
  its owner must load/invoke (backend→api-design, web→frontend-patterns, designer→ui-ux-pro-max,
  QA→verification-loop), plus a Skill Binding Rule forbidding execution without the bound skill.
- **GROUNDING CONTRACT section** (always kept): lists the targets the agent must resolve to real
  `file:line` before executing (route — resolving redirect/barrel indirection, component tree, data
  layer, design tokens, i18n, state branches, and package-manager-from-lockfile). SKILL.md adds a
  hard Conclude gate requiring grounding before the prompt is handed back.
- **Trusted-source internet discovery**: when a skill is not installed locally, research it only
  from npm / GitHub / x.com (reputable authors) — never anonymous gists or low-signal sources.
- **Render-bound verdict**: "Working" now requires the resolved target surface to actually render
  with real data; a build/test failure outside the target is a separate finding.

## [1.5.4] - 2026-06-05

### Fixed

- **Mode/skill routing**: keyword matching now uses word boundaries. Substrings no
  longer misroute tasks — e.g. `"implement checkout flow"` is `feature` (was `audit`
  because `check` ⊂ `checkout`), `"email validation"` is no longer matched as an AI app
  (`ai` ⊂ `email`), and `detectStack("upgrade nextjs")` now resolves `nextjs` instead of
  `general`. Added `tests/skill-matcher.test.js` and routing regression tests.
- **Data integrity check** no longer hard-fails dev runs when a bundled CSV is edited
  without regenerating the manifest; it warns and continues, and is strict only in CI
  (`PROMPT_BUILDER_VERIFY=1`). The check is now memoized per process.

### Security

- Untrusted CLI `task` text is now neutralized (`neutralizeUserText`) before it is embedded
  in the generated prompt or written to a stack-profile cache file: control/ANSI sequences
  are stripped, section-forging delimiters are removed, and length is capped. Shell-suggestion
  queries are additionally stripped of shell metacharacters (`sanitizeShellArg`). Previous
  sanitization only covered the bundled (trusted) CSV data.

### Removed

- Removed the simulated "agent harness" (`--harness`, `scripts/harness.js`,
  `policy-engine.js`, `safety-monitor.js`, `tool-registry.js`, `state-manager.js`,
  `orchestrate.js`, `src/harness-integration.js`) and the broken `migrate-sessions.js`.
  The harness produced byte-identical prompt output and its policy checks were a no-op for
  prompt generation — it advertised governance it did not perform. The reusable error
  categorizer was kept and moved to `src/error-handler.js`, now wired into the CLI.
- Dropped the dead `inferTemplate` export (identity map over `inferMode`).

### Changed

- `SECTION_PRIORITIES` in `context-manager.js` is now the single source of truth for
  token-budget priority; `prompt-assembler` derives each section's priority from it instead
  of duplicating (and diverging) the numbers inline.
- De-leaked private "corp-auction" specifics from the published package: generic admin/dashboard
  discovery hints (no hardcoded private paths), a vanilla Next.js stack profile (no
  bidder/Vuexy/shadcn defaults), and generic examples in `REFERENCE.md` / `anti-patterns.csv`.
- Honest positioning: documented that output is optimized for Claude Code and its skills
  ecosystem (degrades to optional recommendations elsewhere); removed the "7-Layer Agent
  Harness" badge and the `cursor` keyword.

### Added

- `LICENSE` (MIT) and this `CHANGELOG.md`; both added to the published `files` list.
- **SKILL.md "Understand → Clarify → Conclude" core loop**: documents the skill's actual
  purpose — accept plain-language input, ground it in the real codebase (map intent to
  `file:line` targets), ask one focused question only when the code leaves it ambiguous,
  then emit a codebase-grounded prompt rather than a generic one.
