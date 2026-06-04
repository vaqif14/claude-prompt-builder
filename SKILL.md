---
name: prompt-builder
description: Expert-grade prompt architect that analyzes codebases at depth, orchestrates multi-agent discussions, discovers skills from local + GitHub, and builds CCAP-certified Claude Code prompts. Use when user wants a professional prompt, expert analysis, skill discovery, multi-agent plan, or says "prompt builder", "expert prompt", "agent prompt", "analyze and prompt".
---

# Prompt Builder

## Quick start

User says: *"bu səhifədə dizaynı update et"*  
Your output: Full codebase scan → Spawn expert agents → Collect findings → Synthesize → Expert prompt → Metadata card.

## Workflow (6 phases — execute in order)

### Phase 1 — Code-First Intent Clarification

**Read the codebase FIRST. Then ask.**

1. **Scan**: `AGENTS.md`, `package.json`/`build.gradle`, `src/` structure, commits.
2. **Understand the project**: Patterns, conventions, tech debt.
3. **Detect ambiguities from CODE context** — not general assumptions.
4. **Ask 0–2 questions ONLY about code-specific ambiguities**. General questions are forbidden.
5. **If clear from context, proceed WITHOUT questions.**

### Phase 2 — Expert Codebase Analysis

Run diagnostics AND expert analysis:

1. **Build/Test scan**: Run actual build/tests. Record failures with file:line + exact error.
2. **Code Quality**: Complexity, duplication, dead code, smells.
3. **Security Audit**: Input validation, authZ, secrets, SQL/XSS, `npm audit`.
4. **Role/Permission**: Admin vs user endpoints, RBAC, route guards.
5. **Performance**: N+1 queries, bundle size, re-renders.
6. **Test Coverage**: Untested files, flaky tests.

**How**: Spawn parallel `Agent(subagent_type="explore")` per domain. Read error logs.

### Phase 2.5 — Agent Orchestration (Multi-Agent Discussion)

For each analysis domain, spawn a specialist agent:

1. **Match domain to skill**: See `data/agents.csv` for domain→skill mapping.
2. **Spawn agent**: `Agent(subagent_type="explore")` with skill context.
3. **Agent prompt**: Role + Task + Context + Skill + Constraints + Output format.
4. **Discussion**: Read outputs. Validate against codebase. Reconcile conflicts.
5. **Parallel strategy**: Spawn up to 4 agents concurrently. Wait for all before synthesis.

### Phase 3 — Solution Design

For EACH issue from Phase 2 / 2.5:

1. Read failing file at exact line.
2. Propose concrete fix with actual code change.
3. Reference matched skill patterns.
4. Verify minimal change, no regression.

Rule: Never say "fix the error" — always say "change X to Y at file:line using [skill] pattern".

### Phase 4 — Prompt Architecture (CCAP)

Build using 5 certified patterns: System Contract, Context Window, Tool Directives, Acceptance Gates, Output Schema.

### Phase 5 — Prompt Assembly & Polish

Assemble: Role → Mission → Context → Matched Skills → Sub-tasks → Constraints → Tool Permissions → Acceptance Criteria → Output Format → Memory Files.

Polish: remove ambiguity, quantify, fence scope, add "Stop and Ask".

## Output Format

### 1. Execution Plan (Todos)

Checkbox list. Mark first active with ❄️. Wrap lines at 80 chars.

### 2. Generated Prompt

Paste-ready prompt in code block. Include:
- **Matched Skills** section (which agent handled which domain)
- **Todos** section for progress tracking

### 3. Metadata Card

Table: Complexity | Context Size | Model | Parallel Agents | Skills | Risk | Rollback.

## Advanced

See [REFERENCE.md](REFERENCE.md) for: CCAP deep dive, agent orchestration mechanics, agent prompt templates, discussion rules, synthesis patterns, skill discovery, GitHub search, anti-pattern catalog.
