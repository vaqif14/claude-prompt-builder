---
name: prompt-builder
description: Prompt engineer powered by agent harness architecture. Profiles users, analyzes codebases, orchestrates multi-agent discussions via tool registry + policy engine + state management + structured error handling, and builds CCAP-certified Claude Code prompts. Use when user wants a professional prompt, expert analysis, autonomous agent plan, or says "prompt builder", "expert prompt", "agent prompt", "analyze and prompt".
---

# Prompt Builder (Agent Harness Architecture)

## Quick start

User says: *"bu səhifədə dizaynı update et"*  
Your output: Direct prompt generation → 0–1 clarifying question (only if task is ambiguous) → Paste-ready prompt + Execution plan + Metadata card.

**Rule:** Never read files unless user explicitly asks for codebase analysis. Prompt-first always.

## Harness Components (7 layers — fully implemented)

Each layer has a dedicated script under `scripts/`. Run `node scripts/harness.js` for a live demo.

### 1. Tool Registry (`scripts/tool-registry.js`)

Catalog of capabilities: built-in (`read`, `write`, `edit`, `glob`, `grep`, `shell`, `Agent()`), skill-based (`ui-ux-pro-max`, `java-code-review`), custom. Each tool: `name`, `description`, `input_schema`, `pre_hooks[]`, `post_hooks[]`.

```js
const { getToolRegistry, findTool } = require('prompt-builder/scripts/tool-registry');
const registry = getToolRegistry();
const tool = findTool('write');
```

### 2. Policy Engine (`scripts/policy-engine.js`)

PreToolUse hooks run **before** any tool execution:
- **Scope gate**: blocks writes outside allowed paths
- **Permission check**: enforces tool access levels
- **Destructive review**: >5 files modified → block & ask human
- **Rate limit**: prevents excessive agent spawns

Blocked → returns structured error with `errorCategory`.

```js
const { applyPolicies } = require('prompt-builder/scripts/policy-engine');
const result = applyPolicies('write', { file_path: 'src/app.tsx' }, state);
// result: { allowed: true } | { allowed: false, reason: '...', errorCategory: '...' }
```

### 3. State Management (`scripts/state-manager.js`)

Session state: `{"iteration": 0, "verified": false, "files_seen": [], "errors": [], "agents": {}, "files_modified": []}`. Persisted to `memory/<session>.json`.
- PreToolUse reads current state
- PostToolUse updates state (files_modified, iteration, agents)
- Agents receive only relevant slice

```js
const { loadState, updateState, logAudit } = require('prompt-builder/scripts/state-manager');
const state = loadState('session-1');
updateState('session-1', { iteration: state.iteration + 1 });
```

### 4. Error Handling (`scripts/error-handler.js`)

All errors become structured responses:
- `transient` → retry with exponential backoff
- `permission` → escalate, no retry
- `validation` → self-correct, retry once
- `internal` → surface to human

```js
const { categorizeError, withRetry } = require('prompt-builder/scripts/error-handler');
const categorized = categorizeError(new Error('Connection timeout'));
// { category: 'transient', isRetryable: true, retryAfterMs: 1000 }
```

### 5. Orchestration Engine (`scripts/harness.js`)

- **Single Agent Loop**: execute → check stop_reason → loop or exit
- **Coordinator Pattern**: decompose → spawn subagents in parallel → collect → synthesize
- **Parallel Execution**: multiple `Agent()` calls in same turn
- **Safety Valve**: `MAX_ITERATIONS = 50`

```js
const { AgentHarness } = require('prompt-builder/scripts/harness');
const harness = new AgentHarness('my-session');
const result = await harness.execute('write', { file_path: 'src/app.tsx', content: '...' });
const orch = await harness.runOrchestration('task', domains);
```

### 6. Output Normalization (PostToolUse)

Run **after** tool returns:
- Reshape raw data → human-readable
- Optimize tokens (truncate/summarize)
- Update state (iteration++, files_modified)
- Append audit log

### 7. Safety Mechanisms (`scripts/safety-monitor.js`)

- **Iteration limit**: 50 turns max
- **Circuit breaker**: 3 consecutive failures → stop, escalate
- **File limit**: 5 files modified → ask human
- **Human escalation**: explicit request OR exceeds authority OR repeated failures
- **Rollback**: every change independently revertible

```js
const { SafetyMonitor, shouldEscalate } = require('prompt-builder/scripts/safety-monitor');
const monitor = new SafetyMonitor('my-session');
const check = monitor.checkAll(state);
const escalate = shouldEscalate('permission', 10, 0);
```

## Workflow

### Phase 1 — Prompt-First Intent Capture

1. Parse user task for ambiguity (missing stack? missing scope? vague action?)
2. If clear → skip to Phase 5 (Prompt Assembly)
3. If ambiguous → ask **1 concise question** only, then proceed
4. Never read files unless user says "analyze codebase" or "audit"

### Phase 2–4 — Conditional Deep Analysis (only when requested)

If user says **"analyze codebase"**, **"audit"**, or **"deep dive"**:
1. Initialize harness: register tools, load policies, init state
2. Spawn parallel agents per domain (UI-UX, security, performance, etc.)
3. Collect findings → validate → reconcile conflicts
4. Design concrete fixes with exact file:line references

If user gives a **straight task** (e.g., "add timer", "fix bug", "refactor"): skip to Phase 5.

### Phase 5 — Prompt Assembly (CCAP)

Build prompt with these sections in order:
1. **System Contract** — role, mission, authority level
2. **Context Window** — stack, user profile, constraints
3. **Tool Directives** — which tools allowed/blocked
4. **Acceptance Gates** — definition of done
5. **Output Schema** — expected format
6. **Todos** — checkbox list for progress tracking

Polish: remove ambiguity, quantify everything, fence scope, add "Stop and Ask" trigger.

## Output Format

1. **Execution Plan (Todos)** — checkbox list, first active with ❄️
2. **Agent Findings** — per subagent: role, files, fixes, tests, risks
3. **Generated Prompt** — paste-ready code block with Matched Skills + Todos
4. **State Snapshot** — session state after execution
5. **Metadata Card** — Complexity | Model | Agents | Risk | Rollback

## Real Agent Harness (Option B Implementation)

All 7 layers are **implemented scripts**, not conceptual architecture. You can `require()` them directly:

```js
const { AgentHarness } = require('prompt-builder/scripts/harness');

async function main() {
  const harness = new AgentHarness('auction-fix');
  
  // Single tool with full harness wrapping
  const result = await harness.execute('write', {
    file_path: 'src/app.tsx',
    content: '...'
  });
  // result: { success: true, result: {...} } | { success: false, error: '...', errorCategory: '...' }
  
  // Multi-agent orchestration
  const domains = [
    { domain: 'ui-ux', skill: 'ui-ux-pro-max', agentType: 'explore' },
    { domain: 'frontend-code', skill: 'frontend-patterns', agentType: 'explore' }
  ];
  const orchestration = await harness.runOrchestration('design update', domains);
  // orchestration: { task, agents: 2, findings: [...], state: {...} }
  
  console.log(harness.getStatus());
}
```

### Script Map

| Script | Purpose | Exported API |
|---|---|---|
| `scripts/harness.js` | Main orchestration engine | `AgentHarness` |
| `scripts/tool-registry.js` | Tool catalog + discovery | `getToolRegistry()`, `findTool()` |
| `scripts/policy-engine.js` | PreToolUse hooks | `applyPolicies()`, `ALLOWED_FILES` |
| `scripts/state-manager.js` | Session persistence | `loadState()`, `updateState()`, `logAudit()` |
| `scripts/error-handler.js` | Structured error handling | `categorizeError()`, `withRetry()` |
| `scripts/safety-monitor.js` | Circuit breaker + limits | `SafetyMonitor`, `shouldEscalate()` |
| `scripts/orchestrate.js` | Agent matching + prompt gen | `matchAgents()`, `generateAgentPrompt()` |
| `scripts/build.js` | CCAP prompt assembly | `buildPrompt()`, `optimizePrompt()` |
| `scripts/search.js` | Skill + template lookup | `searchSkills()`, `searchTemplates()` |
| `scripts/validate.js` | Prompt quality + safety | `validatePrompt()`, `checkSafety()` |

### Demo

```bash
node scripts/harness.js        # Full harness demo
node scripts/tool-registry.js  # List all tools
node scripts/safety-monitor.js # Show safety config
```

## Advanced

See [REFERENCE.md](REFERENCE.md) for: tool registry schema, policy hook templates, state patterns, error deep dive, orchestration mechanics, safety circuit breaker, agent harness examples.
