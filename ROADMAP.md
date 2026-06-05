# Prompt Builder 1.6.0 Roadmap

Research date: 2026-06-05

This roadmap converts Anthropic Claude Code guidance, Anthropic agent-engineering guidance, and current X/Twitter ecosystem signals into implementation-ready features for the next major Prompt Builder release.

## Expert Verdict

Version 1.5.2 is directionally strong: it already has stack detection, skill discovery, stack-profile caching, agent task boards, model routing, validation, and token budgeting. The next professional jump is not "more prompt text". The next jump is a source-backed agent operating system:

- discover/load only the skills and tools needed for the task
- isolate research, review, and verification in separate agent contexts
- make verification the product, not an afterthought
- encode Anthropic-style simple composable workflows
- keep prompt output small by storing reusable context in project-local files

## Source Signals

| Signal | Source | Feature impact |
|---|---|---|
| Claude Code best practices emphasize verification, context management, subagents, hooks, MCP, plugins, parallel sessions, and adversarial review. | https://code.claude.com/docs/en/best-practices | Add operating modes for verification-first prompts, isolated subagent research, fresh-context review, and permission/hook recommendations. |
| Anthropic context engineering recommends tight, informative context, minimal viable toolsets, clear tool boundaries, token-efficient tool responses, and canonical examples. | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | Add context diet scoring, tool overlap warnings, and cached source packs instead of repeating large discovery text. |
| Anthropic tool-writing guidance treats tools as contracts for non-deterministic agents and recommends prototypes, evals, namespacing, token-efficient returns, and prompt-engineered tool specs. | https://www.anthropic.com/engineering/writing-tools-for-agents | Add tool/MCP registry audit and tool-description scoring. |
| Anthropic agent patterns favor simple composable systems first: routing, prompt chaining, parallelization, orchestrator-workers, evaluator-optimizer, then autonomous agents only when warranted. | https://www.anthropic.com/engineering/building-effective-agents | Add workflow-pattern selection to every generated prompt. |
| Anthropic skill best practices emphasize concise SKILL.md files, progressive disclosure, model testing, clear descriptions, and one-level references. | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | Add skill authoring/review mode and skill bloat detector. |
| Built with Opus 4.6 hackathon winners were domain-heavy; four out of five were not professional developers, proving domain expertise plus Claude Code can win. | https://claude.com/blog/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon | Add hackathon mode focused on domain insight, narrow MVP, demo proof, and pitch/readme evidence. |
| X/Twitter ecosystem signals show large Claude Code setups with many agents/skills/hooks/MCP configs, but also context-overload risk. | https://x.com/techNmak/status/2035277881614758143 | Add selective install profiles, not bulk install. |
| X/Twitter ecosystem signals position `.claude/` as an auditable workflow portfolio: CLAUDE.md, skills, hooks, MCP, subagents, and plugins. | https://x.com/heynavtoor/status/2036861280859124100 | Add `.claude` portfolio audit and project agent-readiness report. |
| X/Twitter MCP discussions point to context overload, auth pain, failed tool calls, OAuth/session needs, JSON output, and sandbox proxying. | https://x.com/apify/status/2011556498477105383 | Add MCP readiness checks, auth/sandbox warnings, and JSON-first tool invocation guidance. |
| X/Twitter trend summaries mention MCP Tool Search dynamically loading only needed tool descriptions to reduce context pressure. | https://x.com/i/trending/2011635973076000880 | Add tool-search-first protocol and tool-context budget warnings. |

## 1.6.0 Feature Backlog

### P0: Agentic Workflow Router

Add a workflow classifier that selects one of:

- single-pass prompt
- prompt chain
- routing
- parallel review
- orchestrator-workers
- evaluator-optimizer
- autonomous loop

Why: Anthropic recommends simple composable patterns before full autonomy. Prompt Builder should tell the next agent which workflow shape to use, not only which skills to load.

Acceptance:

- `generatePrompt()` metadata includes `workflowPattern`.
- Prompts include a short "Workflow Pattern" section under 120 tokens.
- Tests cover at least audit, bugfix, design-review, security-review, and hackathon tasks.

### P0: Verification-First Contract

Upgrade every mode with an explicit verification contract:

- what can be proven by source
- what can be proven by command output
- what can be proven by browser/device evidence
- what is blocked by credentials, server, sandbox, or missing tooling

Why: Claude Code guidance is blunt: if the agent cannot verify it, it should not claim it works.

Acceptance:

- Audit prompts cannot output `Working` unless all evidence gates pass.
- Feature/bugfix prompts require regression evidence.
- UI prompts require browser/device screenshot rules when available.

### P0: Context Diet Score

Add a `contextDiet` metric and warnings:

- prompt token estimate
- repeated discovery avoided by stack profile
- tool/skill section count
- high-risk bloat sections
- recommended `--max-tokens` value

Why: Context pressure is the main failure mode across Anthropic docs and X ecosystem posts.

Acceptance:

- `--context-report` includes a bloat warning list.
- Default prompts remain under 3000 estimated tokens for common tasks.
- Stack-profile HIT avoids broad search text.

### P1: Tool/MCP Readiness Audit

Add a mode or section that audits available integrations:

- MCP servers
- CLI tools
- auth state
- sandbox/network constraints
- JSON/streaming output support
- tool overlap and ambiguity

Why: MCP can be powerful, but tool overload and auth failures burn context and derail agents.

Acceptance:

- New `tooling-review` mode or `--tooling-report` flag.
- Search data includes MCP/tool patterns.
- Prompt warns before recommending a tool that requires auth or broad permissions.

### P1: `.claude` Portfolio Audit

Add a project-readiness audit for:

- `CLAUDE.md`
- `.claude/skills`
- `.claude/agents`
- hooks/settings
- MCP config
- plugin footprint
- missing verification scripts

Why: The ecosystem increasingly treats agent configuration as production infrastructure. Prompt Builder can become the first-pass auditor.

Acceptance:

- New `agent-readiness` mode.
- Output score: Context, Skills, Agents, Hooks, MCP, Verification, Safety.
- No large files are inlined; use file paths and summaries.

### P1: Hackathon Mode

Add a `hackathon` mode optimized for Claude Code competitions:

- domain-first problem framing
- one-week or one-day MVP scope
- demo script
- judging criteria
- risk-killing task split
- build/pitch/readme checklist
- production-looking evidence, not feature sprawl

Why: Anthropic hackathon winners show domain expertise plus narrow proof beats generic engineering breadth.

Acceptance:

- `inferMode()` detects hackathon, demo, MVP, pitch, judging.
- Generated prompt creates Founder/Product, Builder, QA, Demo/Pitch lanes.
- Output includes README/demo/video evidence requirements.

### P1: Skill Bloat Detector

Add checks for skill quality:

- frontmatter description clarity
- SKILL.md length
- one-level references
- unnecessary generic explanation
- missing scripts for deterministic operations
- no test/eval examples

Why: Anthropic skill guidance is concise and progressive; Prompt Builder should help create skills that do not waste context.

Acceptance:

- `skill-review` mode or `--review-skill <path>`.
- Findings include file:line references.
- Tests include a bloated sample skill and a concise sample skill.

### P2: Selective Install Profiles

Add profile commands:

- `--profile web`
- `--profile backend`
- `--profile mobile`
- `--profile ai-agent`
- `--profile hackathon`

Each profile should recommend a small curated set of skills, agents, hooks, and MCP tools.

Why: X/ECC-style mega setups are useful inspiration, but bulk install is the wrong default for token cost and reliability.

Acceptance:

- Profile recommendations are capped.
- Missing installs always require user approval.
- Output explains why each item is included.

### P2: Eval Harness V2

Turn validation from presence scoring into scenario scoring:

- prompt output obeys mode
- does not overclaim
- picks correct skills
- keeps token budget
- includes verification gates
- handles missing skills/auth/tooling

Why: Anthropic tool and skill guidance consistently recommends testing with real tasks and iterating based on failure modes.

Acceptance:

- Fixtures for 20 real user prompts.
- CI-friendly JSON report.
- Regression threshold before publish.

## Implementation Order

1. Add `workflowPattern` classifier and tests.
2. Add context diet report and bloat warnings.
3. Add `hackathon` and `agent-readiness` modes.
4. Add tool/MCP readiness report.
5. Add skill bloat detector.
6. Upgrade harness eval fixtures.

## Non-Goals

- Do not bulk-copy ECC scale. Use it as an architectural signal only.
- Do not make every prompt longer. Prefer cached profiles, source packs, and selective sections.
- Do not silently install skills, plugins, MCP servers, or global packages.
- Do not claim X/Twitter posts are authoritative when official Anthropic docs conflict with them.
