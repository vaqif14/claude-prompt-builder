---
name: prompt-builder
description: Architect-grade prompt engineer that builds production-ready Claude Code prompts by profiling the user, analyzing the codebase, and applying Claude Code Architecture certified patterns. Use when user wants a professional prompt, needs to delegate a task to another AI agent, or says "prompt builder", "cursor prompt", "agent prompt", "professional prompt", "claude prompt".
---

# Claude Prompt Architect

## Quick start

User says: *"auksiyon timer-i duzelt"*  
Skill output: User profile + Codebase profile → Architect-certified Claude Code prompt ready to paste into another session.

## Workflow

### Phase 1 — User Profiling (Know the Engineer)

Build a **User Profile** before writing any prompt:

1. **Language & Style**: Preferred language, direct vs diplomatic, bullets vs prose.
2. **Tech Stack DNA**: Primary stack, ORM, state management, UI kit, testing approach.
3. **Architecture Bias**: Monolith vs microservices, DDD vs pragmatic, type strictness.
4. **Quality Bar**: Test coverage expectation, lint strictness, documentation discipline.
5. **Workflow Preference**: Execution-first vs plan-first, TDD vs test-after, incremental vs big-bang.
6. **Anti-patterns**: What the user HATES (e.g., `any`, magic strings, god classes).

How: Read `AGENTS.md`, `CLAUDE.md`, commit messages, review style.

### Phase 2 — Codebase Profiling (Know the Terrain)

Build a **Codebase Profile**:

1. **Architecture Pattern**: Layered, hexagonal, feature-based? Entry points?
2. **Tech Inventory**: Language/framework versions, key dependencies.
3. **Conventions**: Naming, file organization, import patterns.
4. **State & Data Flow**: Where state lives, API patterns, caching.
5. **Testing Topology**: Unit/integration/E2E ratio, mock strategy.
6. **Integration Points**: External APIs, DB, brokers, auth.
7. **Known Issues**: Tech debt, FIXMEs, flaky tests.

How: `Agent(subagent_type="explore")` parallel scans of source, configs, tests.

### Phase 3 — Task Decomposition

Break request into **atomic sub-tasks**:
- Each independently verifiable.
- Identify dependencies (what blocks what).
- Mark critical path vs parallelizable.
- Flag skill requirements per sub-task.

### Phase 4 — Prompt Architecture (CCAP)

Build using **Claude Code Architecture Patterns**:

1. **System Contract**: Role, expertise level, decision authority.
2. **Context Window**: High-signal only. Summaries > dumps. Paths > contents.
3. **Tool Directives**: When tools may run, when to ask permission, output schemas.
4. **Acceptance Gates**: Done criteria, test expectations, rollback conditions.
5. **Output Schema**: Structured output (JSON, tables, checklists).

### Phase 5 — Prompt Assembly & Polish

Assemble in order:
```
Role & Authority → Mission → Context → Sub-tasks → Constraints
→ Tool Permissions → Acceptance Criteria → Output Format → Memory Files
```

Polish: remove ambiguity, quantify, fence scope, add "Stop and Ask" for irreversible ops.

## Output

Deliver prompt in code block + **Metadata Card** (Complexity, Context Size, Model, Parallel Agents, Skills, Risk, Rollback).

## Advanced

See [REFERENCE.md](REFERENCE.md) for:
- CCAP deep dive (System Contract, Context Window, Tool Directives, Acceptance Gates, Output Schema)
- Prompt templates by task type (Feature, Refactor, Bugfix, Security Audit)
- User profiling checklist (20+ signals)
- Codebase profiling checklist (by stack)
- Anti-pattern catalog (prompt smells)
- Before/after example with full generated prompt
