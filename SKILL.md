---
name: prompt-builder
description: Architect-grade prompt engineer that builds production-ready Claude Code prompts by profiling the user, analyzing the codebase, and applying Claude Code Architecture certified patterns. Use when user wants a professional prompt, needs to delegate a task to another AI agent, or says "prompt builder", "cursor prompt", "agent prompt", "professional prompt", "claude prompt".
---

# Prompt Builder

## Quick start

User says: *"auksiyon timer-i duzelt"*  
Your output: User profile → Codebase profile → Execution plan with checkboxes → Paste-ready prompt → Metadata card.

## Workflow (5 phases — execute in order)

### Phase 1 — User Profiling

Detect user signals before writing anything:

1. **Language & Style**: Read `AGENTS.md` for language preference. Check conversation tone.
2. **Tech Stack DNA**: Read `package.json` / `build.gradle` for frameworks, ORM, UI kit.
3. **Architecture Bias**: Check source tree — layered? feature-based? DDD?
4. **Quality Bar**: Check `tsconfig.json` strictness, test coverage, linter config.
5. **Workflow**: Check commit style, review preference, risk tolerance.
6. **Anti-patterns**: Scan code for `any`, magic strings, god classes.

**How**: Spawn 1–2 `Agent(subagent_type="explore")` to scan `AGENTS.md`, root configs, recent commits in parallel.

### Phase 2 — Codebase Profiling

Map the terrain:

1. **Architecture Pattern**: Entry points, layer boundaries, module ownership.
2. **Tech Inventory**: Language/framework versions, key dependencies.
3. **Conventions**: Naming, file organization, import patterns.
4. **State & Data Flow**: Where state lives, API patterns, caching.
5. **Testing Topology**: Unit/integration/E2E ratio, mock strategy.
6. **Integration Points**: External APIs, DB, brokers, auth.
7. **Known Issues**: Tech debt, FIXMEs, flaky tests.

**How**: Spawn `Agent(subagent_type="explore")` parallel scans of `src/`, tests, configs. Summarize in 5 bullets.

### Phase 3 — Task Decomposition

Break request into atomic sub-tasks:
- Each independently verifiable.
- Identify dependencies (what blocks what).
- Mark critical path vs parallelizable.
- Flag skill requirements per sub-task.

### Phase 4 — Prompt Architecture (CCAP)

Build using 5 certified patterns:

1. **System Contract**: Role, expertise level, decision authority.
2. **Context Window**: High-signal only. Summaries > dumps. Paths > contents.
3. **Tool Directives**: When tools may run, when to ask permission, output schemas.
4. **Acceptance Gates**: Done criteria, test expectations, rollback conditions.
5. **Output Schema**: Structured output (tables, checklists).

### Phase 5 — Prompt Assembly & Polish

Assemble in order:
```
Role & Authority → Mission → Context → Sub-tasks → Constraints
→ Tool Permissions → Acceptance Criteria → Output Format → Memory Files
```

Polish: remove ambiguity, quantify, fence scope, add "Stop and Ask" for irreversible ops.

## Output Format (deliver in this order)

### 1. Execution Plan (Todos)

Checkbox list of sub-tasks. Mark first active with ❄️:

```
## [Task Title]

- ❄️ [ ] Active sub-task → target
- [ ] Next sub-task → target
- [ ] Final sub-task → target
```

Wrap long lines naturally (max 80 chars per line).

### 2. Generated Prompt

Paste-ready prompt in fenced code block. Include a **Todos** section inside so the executing agent tracks progress checkbox-style.

### 3. Metadata Card

Table: Complexity | Context Size | Model | Parallel Agents | Skills | Risk | Rollback.

## Advanced

See [REFERENCE.md](REFERENCE.md) for:
- CCAP deep dive, prompt templates by task type, user/codebase profiling checklists, anti-pattern catalog, before/after example.
