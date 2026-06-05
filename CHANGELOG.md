# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
