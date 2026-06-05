# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
