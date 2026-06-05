# Claude Prompt Architect — Reference

> Deep technical reference for Prompt Builder. Covers CCAP patterns, prompt templates, profiling checklists, agent orchestration mechanics, and extension points.  
> For day-to-day usage see [SKILL.md](./SKILL.md). For quick lookups see [QUICKREF.md](./QUICKREF.md).

---

## CCAP: Claude Code Architecture Patterns

## Next Version Research

The source-backed 1.6.0 plan lives in [ROADMAP.md](./ROADMAP.md). Use it when deciding what to implement next, especially for Anthropic-style workflow routing, verification-first prompts, context diet scoring, MCP/tool readiness, hackathon mode, and skill bloat review.

The condensed pattern catalog is searchable through `data/patterns/agentic-next.csv`:

```bash
node scripts/search.js "ContextDiet"
node scripts/search.js "HackathonDomainFirst"
node scripts/search.js "ToolSearchFirst"
```

### 1. System Contract (Altitude)

Set the agent's altitude — how high-level vs low-level should it operate?

| Altitude | Use When | Example Opening |
|----------|----------|-----------------|
| **Strategic** | Architecture decisions, tech choices | "You are a staff engineer reviewing..." |
| **Tactical** | Feature implementation, integration | "You are a senior engineer implementing..." |
| **Implementation** | Bug fix, refactor, small feature | "You are an engineer fixing..." |

Rules:
- Higher altitude = more autonomy, broader scope
- Lower altitude = more constraints, specific files
- Never mix altitudes in one prompt. Split into sub-tasks if needed.

### 2. Context Window (Signal)

Context hygiene is the #1 predictor of prompt success.

**DO:**
- Summarize historical context in 3–5 bullet points
- Reference memory files instead of inlining large text
- Send file paths, not file contents (agent reads what it needs)
- Use deltas: "Since last session, X changed to Y"

**DON'T:**
- Dump entire files into the prompt
- Repeat context that hasn't changed
- Send raw logs without summarizing the error pattern

**Memory File Pattern:**
```
memory/progress.md — decisions, TODOs, blockers
memory/context.json — project facts, conventions, glossary
memory/tests.json — acceptance criteria, edge cases
```

### 3. Tool Directives (Orchestration)

Be explicit about tool access:

```
Tool Permissions:
- READ: freely explore codebase, docs, memory files
- WRITE: only files listed in "Affected Files" section
- EXECUTE: test commands only (./gradlew test, npm test)
- SPAWN: may spawn up to 2 parallel explore agents
- FORBIDDEN: git commit, git push, production deploy

Stop and Ask:
- Before deleting any file
- Before modifying >5 files in one operation
- Before changing database schema
```

### 4. Acceptance Gates (Validation)

Define done as a checklist, not a vague statement:

```
Definition of Done:
- [ ] All acceptance criteria pass (see below)
- [ ] New code has ≥80% test coverage
- [ ] Existing tests still pass (npm test, ./gradlew test)
- [ ] Lint/type checks pass (npm run lint, ./gradlew check)
- [ ] CHANGELOG.md updated with Conventional Commit style
- [ ] No secrets or PII in code or logs
- [ ] Rollback plan documented (git revert hash, feature flag name)
```

### 5. Output Schema (Structure)

Always request structured output:

```
Output Format:
For each sub-task, return:
1. SUMMARY: one-line outcome
2. FILES: list of modified/created files with change type
3. DIFFS: unified diff per file (if code changed)
4. TESTS: new/updated test files
5. RISKS: top 3 rollback conditions
6. NOTES: any assumptions or follow-up items
```

---

## Prompt Templates by Task Type

### Template A: Feature Implementation

```text
Role: Senior [stack] engineer implementing a new feature.
Mission: [One sentence — what to build]

User Profile:
- Prefers execution-first, iterative delivery
- Strict TypeScript / Java type safety
- Tests required for all public APIs
- Changelog updates mandatory

Codebase Profile:
- Stack: [versions]
- Pattern: [architecture pattern]
- State: [where state lives]
- Tests: [testing framework + location]

Sub-tasks:
1. [Atomic task 1] → [files]
2. [Atomic task 2] → [files]
3. [Atomic task 3] → [files]

Constraints:
- Follow existing patterns in [reference file]
- Do NOT add new dependencies without approval
- Do NOT modify unrelated files
- All DTOs must be records / interfaces

Tool Permissions:
- READ: explore codebase freely
- WRITE: only files in sub-task list
- EXECUTE: npm test | ./gradlew test
- FORBIDDEN: git commit, push, schema migration

Acceptance Criteria:
- [ ] Feature works per user requirements
- [ ] Unit tests cover happy path + 2 edge cases
- [ ] Integration test covers end-to-end flow
- [ ] No TypeScript/Java compilation errors
- [ ] CHANGELOG.md updated

Output Format:
For each sub-task:
1. SUMMARY
2. FILES modified/created
3. KEY implementation decisions
4. TEST coverage summary
```

### Template B: Refactor / Modernization

```text
Role: Staff engineer performing a targeted refactor.
Mission: [What to refactor and why]

User Profile:
- Prefers incremental, reviewable changes
- Risk-averse on production code
- Values backwards compatibility

Codebase Profile:
- [Current pattern] → [Target pattern]
- Critical paths: [list files that must not break]
- Test coverage: [current % on affected files]

Migration Plan:
1. Prepare: add new pattern alongside old
2. Migrate: move call sites one by one
3. Verify: tests pass at each step
4. Clean: remove old pattern

Constraints:
- Zero breaking changes to public APIs
- Each commit must be independently revertible
- No changes to business logic (behavior-preserving)

Acceptance Criteria:
- [ ] All existing tests pass without modification
- [ ] New pattern matches target specification
- [ ] No regression in performance (benchmark if applicable)
- [ ] Deprecation notes added for any removed APIs
```

### Template C: Bug Fix / Diagnosis

```text
Role: Debugging engineer investigating and fixing a bug.
Mission: [Symptoms] → [Root cause hypothesis] → [Fix]

Context:
- Error: [error message or symptom]
- Repro: [steps to reproduce]
- Affected: [user reports, sentry link, log entries]

Investigation Plan:
1. Reproduce the issue locally
2. Trace code path from entry to failure point
3. Identify root cause (not symptom)
4. Implement minimal fix
5. Add regression test

Constraints:
- Fix must be minimal — do not refactor adjacent code
- If root cause is architectural, propose short-term fix + long-term refactor as separate task
- Document workaround if fix cannot be deployed immediately

Acceptance Criteria:
- [ ] Bug reproduced and verified fixed
- [ ] Regression test added
- [ ] No new warnings or errors introduced
- [ ] Root cause documented in commit message or issue
```

### Template D: Security / Audit

```text
Role: Security engineer performing a focused audit.
Mission: [Scope of audit — endpoint, module, flow]

Checklist:
- [ ] Input validation (sanitize all user inputs)
- [ ] AuthZ checks (role-based access control)
- [ ] Secret handling (no hardcoded keys, env vars only)
- [ ] SQL injection / NoSQL injection prevention
- [ ] XSS / CSRF protection
- [ ] Rate limiting on public endpoints
- [ ] Audit logging for sensitive operations
- [ ] Dependency vulnerabilities (check CVEs)

Constraints:
- Do NOT modify production credentials or configs
- Do NOT run penetration tests against production
- Report only — fixes are a separate task unless critical

Output Format:
| Severity | Finding | Location | Recommendation |
|----------|---------|----------|----------------|
| Critical/High/Med/Low | ... | file:line | ... |
```

---

## User Profiling Checklist

Detect these signals from conversation history, AGENTS.md, and code style:

### Communication
- [ ] Primary language (Azerbaijani / Turkish / English / mixed)
- [ ] Style: concise/direct vs detailed/explanatory
- [ ] Format preference: bullets vs paragraphs vs tables
- [ ] Tone: casual vs formal, emoji usage

### Technical
- [ ] Stack: frontend framework, backend framework, DB, ORM
- [ ] Language strictness: strict TS, checked exceptions, etc.
- [ ] Architecture: DDD, Clean Architecture, pragmatic, legacy
- [ ] State management: Redux, Zustand, Context, Jotai
- [ ] UI approach: component library, custom CSS, Tailwind
- [ ] API style: REST, GraphQL, tRPC, gRPC

### Quality
- [ ] Test philosophy: TDD, test-after, "tests are waste"
- [ ] Coverage expectation: 0%, 50%, 80%, 100%
- [ ] Lint/format: Prettier, ESLint, Checkstyle, Spotless
- [ ] Documentation: inline comments, README, ADRs, none
- [ ] Commit style: Conventional Commits, free-form, semantic

### Workflow
- [ ] Pace: execution-first vs plan-first
- [ ] Batch size: micro-commits, feature-per-commit, big-bang
- [ ] Review: self-merge, mandatory review, pair programming
- [ ] Deployment: continuous, scheduled, manual
- [ ] Risk tolerance: aggressive refactor vs safe-and-steady

### Anti-patterns (Things They Hate)
- [ ] `any` types, `Object`, raw `Map`
- [ ] Magic strings / numbers
- [ ] Deep nesting (>3 levels)
- [ ] God classes / files >500 lines
- [ ] Commented-out code
- [ ] Console.log in production code
- [ ] Mixing concerns (UI + business logic)

---

## Codebase Profiling Checklist

### General
- [ ] `README.md` — setup, run, test commands
- [ ] `AGENTS.md` / `CLAUDE.md` — learned preferences
- [ ] `.gitignore` — what is excluded
- [ ] CI/CD config — GitHub Actions, GitLab CI, etc.

### Java / Spring Boot
- [ ] `build.gradle` / `pom.xml` — dependencies, plugins
- [ ] `src/main/java/.../Application.java` — entry point
- [ ] `src/main/resources/application*.yml` — profiles, configs
- [ ] `src/main/resources/db/migration/` — Flyway / Liquibase
- [ ] Package structure — layered, feature-based, hexagonal?
- [ ] Test structure — unit, integration, e2e separation

### TypeScript / Next.js / React
- [ ] `package.json` — dependencies, scripts
- [ ] `tsconfig.json` — strictness level
- [ ] `next.config.js` — routing, i18n, rewrites
- [ ] `src/app/` or `src/pages/` — routing strategy
- [ ] `src/features/` or `src/modules/` — code organization
- [ ] State management files — store definitions
- [ ] API client pattern — fetch, axios, tRPC, React Query

### Infrastructure
- [ ] `docker-compose.yml` — services, networks
- [ ] `Dockerfile` — build stages, base images
- [ ] `k8s/` or `infra/` — deployment configs
- [ ] `.env.example` — required environment variables

---

## Anti-Pattern Catalog (Prompt Smells)

| Smell | Problem | Fix |
|-------|---------|-----|
| **Vague Mission** | "Fix the bug" | "Fix race condition in bid placement causing duplicate bids" |
| **No Constraints** | Agent modifies anything | Explicit file whitelist + forbidden actions |
| **No Acceptance** | "Make it work" | Measurable criteria: "Response time <200ms", "Zero TypeScript errors" |
| **Context Dump** | Pasting 500 lines of code | "See `src/services/bid.ts` for current logic" |
| **Mixed Altitudes** | "Architect AND implement" | Split: Task 1 = design, Task 2 = implement |
| **No Rollback** | Irreversible changes | "Each commit must be revertible; feature flag required" |
| **Ambiguous Pronouns** | "Update it" | "Update `AuctionTimer` component in `src/components/auction/`" |
| **Missing Stop Clause** | Agent deletes production DB | "STOP and ask before any database migration" |

---

## Example: Before / After

### User Request (Before)

> "auksiyonda timer elave et"

### Generated Prompt (After)

```text
Role: Senior Frontend Engineer (Next.js, React, TypeScript)
Mission: Implement a real-time countdown timer for auction lots that
syncs with server time and handles edge cases (auction ended, extended,
pause).

User Profile:
- Prefers execution-first, iterative delivery
- Strict TypeScript (no `any`)
- Tests for all new hooks and components
- Azerbaijani/Turkish communication preferred
- Changelog updates per package

Codebase Profile:
- Stack: Next.js 14 App Router, TanStack Query, Zustand, STOMP WebSocket
- UI: shadcn/ui + Material 3 tokens, Vuexy-like density
- State: Zustand store owns bidder real-time state (see src/realtime/)
- Patterns: Feature-based slices under src/features/, hooks under src/hooks/
- Tests: Jest for unit, Playwright for E2E

Sub-tasks:
1. Analyze existing timer implementations in codebase (if any)
2. Create useAuctionTimer hook in src/hooks/ with:
   - server time sync via STOMP
   - countdown logic with drift correction
   - states: running, paused, extended, ended
3. Create AuctionTimer component in src/components/auction/
   - displays HH:MM:SS format
   - visual states: normal, warning (<1min), ended
   - accessible (aria-live region for screen readers)
4. Integrate timer into lot detail page (src/app/[locale]/auctions/[id]/)
5. Add unit tests for hook logic (edge cases: timezone, drift, negative)
6. Add i18n keys for timer states

Constraints:
- Do NOT modify backend auction logic (read-only from STOMP)
- Do NOT add new npm dependencies (use existing date-fns if present)
- Follow existing hook pattern in src/hooks/useRealtime.ts
- All new code must pass npm run lint && npm run type-check

Tool Permissions:
- READ: explore src/hooks/, src/components/, src/realtime/ freely
- WRITE: only files listed in sub-tasks
- EXECUTE: npm test, npm run lint, npm run type-check
- FORBIDDEN: git commit, git push, backend changes

Acceptance Criteria:
- [ ] Timer displays correct remaining time synced to server
- [ ] Visual state changes at <1 minute (warning color)
- [ ] Timer handles auction extension without page refresh
- [ ] Screen readers announce time changes (aria-live)
- [ ] Unit tests cover: normal countdown, drift correction, ended state
- [ ] No TypeScript errors, no lint errors
- [ ] CHANGELOG.md updated in frontend/

Stop and Ask:
- Before modifying any existing shared hook or component
- If server time sync endpoint does not exist or differs from assumption

Output Format:
For each sub-task:
1. SUMMARY: one-line outcome
2. FILES: created/modified files
3. DECISIONS: key technical choices
4. TESTS: coverage summary
5. RISKS: rollback conditions
```

### Metadata Card

| Field | Value |
|-------|-------|
| **Estimated Complexity** | Medium |
| **Context Window Size** | Medium (~3k tokens) |
| **Recommended Model** | Claude Sonnet 4.5 |
| **Parallel Agents** | Yes — explore agent for codebase scan |
| **Skills Required** | frontend-patterns, ui-ux-pro-max |
| **Risk Level** | Low |
| **Rollback Strategy** | git revert + remove i18n keys |

---

## Agent Orchestration Mechanics

### Agent Spawn Rules

For each analysis domain, decide if an agent is needed:

| Domain | When to Spawn | Skill to Load | Agent Type |
|--------|---------------|---------------|------------|
| UI/UX Design | User mentions design, layout, component | `ui-ux-pro-max` | explore |
| Frontend Code | React/Next.js/Vue component work | `frontend-patterns` | explore |
| Java Quality | Spring Boot code review | `java-code-review` | explore |
| Security | Auth, validation, audit | `springboot-security` or `security-review` | explore |
| Performance | Bundle size, query optimization | `frontend-patterns` or `springboot-patterns` | explore |
| Database | Migrations, schema, queries | `database-migrations` or `jpa-patterns` | explore |
| Testing | Test strategy, coverage | `springboot-tdd` or `e2e-testing` | explore |

### Agent Prompt Template

```
You are a [domain] specialist agent. Your task: [specific sub-task].

Context:
- Project: [name and stack]
- Relevant files: [file paths from codebase analysis]
- Patterns to follow: [conventions from Phase 2]
- User preferences: [from user profile]

Skill to follow:
Read [skill-name]/SKILL.md first and follow its workflow.

Constraints:
- [Boundary 1 from enriched prompt]
- [Boundary 2 from enriched prompt]
- Do NOT: [forbidden action 1]
- Do NOT: [forbidden action 2]

Output:
[Structured format: bullet list, table, markdown]
- SUMMARY: one-line outcome
- FINDINGS: list of issues with file:line references
- SEVERITY: Critical / High / Medium / Low per finding
- RECOMMENDATIONS: concrete fix for each finding

Return your findings as soon as complete. Do not ask clarifying questions.
```

### Discussion Checklist

After collecting agent outputs, validate each:

- [ ] **Reality check**: Does the finding match actual code? (Read the file to verify)
- [ ] **Scope check**: Is the finding within the user's request scope?
- [ ] **Severity accuracy**: Is Critical really critical? Would it block production?
- [ ] **Conflict detection**: Do two agents disagree on the same file/line?
- [ ] **Overlap detection**: Did two agents find the same issue? Deduplicate.

If conflict detected:
1. Read the disputed file yourself
2. Decide which agent is correct based on codebase reality
3. If unclear, spawn a follow-up agent with both viewpoints

### Synthesis Patterns

When merging agent outputs into unified analysis:

1. **Deduplicate**: Same file mentioned by multiple agents → merge into single entry
2. **Reconcile conflicts**: Different agents suggest different patterns → pick established codebase pattern
3. **Fill gaps**: Agent missed edge case → add it natively
4. **Priority sort**: Critical findings first, then High, Medium, Low
5. **Cross-reference**: Link findings to matched skills for the final prompt

### Parallel Agent Strategy

For maximum efficiency, spawn agents concurrently when domains are independent:

```
# Example: parallel analysis for a page redesign
Agent 1 (explore + ui-ux-pro-max): Analyze current design system usage, tokens, density
Agent 2 (explore + frontend-patterns): Analyze component structure, state, data flow
Agent 3 (explore + security-review): Check auth, input validation on the page
Agent 4 (explore + e2e-testing): Analyze current test coverage for the page

# Skill synthesizes all four outputs into final expert plan
```

### Agent-to-Agent Communication

Agents are independent by default. Share output between agents ONLY when:
- Agent B needs to know Agent A's findings to avoid duplication
- One agent's output is input for another's task
- Resolving a conflict requires both viewpoints

Use this pattern:
```
Agent B prompt:
  Context from Agent A: [summary of Agent A's key findings]
  Your task: [build on or validate Agent A's findings]
```

---

## Changelog

Release history is tracked in [CHANGELOG.md](./CHANGELOG.md).  
> Note: Create `CHANGELOG.md` at the repo root if it does not yet exist. Follow [Keep a Changelog](https://keepachangelog.com/) format with [Conventional Commits](https://www.conventionalcommits.org/) categories.
