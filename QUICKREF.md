# Prompt Builder — Quick Reference

## One-liner install
```bash
npm install -g @vaqif14/prompt-builder
```

## Use as library
```js
const { AgentHarness } = require('@vaqif14/prompt-builder/scripts/harness');
const harness = new AgentHarness('my-session');
const result = await harness.execute('write', { file_path: 'src/app.tsx', content: '...' });
```

## Use as CLI
```bash
prompt-builder "design update for auction page"
# or
npx @vaqif14/prompt-builder "fix TypeScript errors in admin panel"
```

## Harness API

### AgentHarness
```js
const harness = new AgentHarness(sessionId);
await harness.execute(toolName, params);        // single tool with full harness
await harness.runOrchestration(task, domains);  // multi-agent parallel
harness.getStatus();                            // { iteration, filesModified, agentsSpawned }
```

### Policy Engine
```js
const { applyPolicies } = require('prompt-builder/scripts/policy-engine');
applyPolicies('write', { file_path: 'src/app.tsx' }, state);
// → { allowed: true } | { allowed: false, reason, errorCategory }
```

### Error Handler
```js
const { categorizeError, withRetry } = require('prompt-builder/scripts/error-handler');
categorizeError(new Error('Connection timeout'));
// → { category: 'transient', isRetryable: true, retryAfterMs: 1000 }
```

### Safety Monitor
```js
const { SafetyMonitor } = require('prompt-builder/scripts/safety-monitor');
const monitor = new SafetyMonitor('session');
monitor.checkAll(state);  // → { safe: true } | { safe: false, reason, action }
```

### State Manager
```js
const { loadState, updateState } = require('prompt-builder/scripts/state-manager');
const state = loadState('session');
updateState('session', { iteration: state.iteration + 1 });
```

## Error Categories
| Category | Trigger | Action |
|---|---|---|
| `transient` | Network, timeout, rate limit | Retry with backoff |
| `permission` | Access denied, scope violation | Escalate to human |
| `validation` | Bad params, schema mismatch | Self-correct, retry once |
| `internal` | Bug, unknown error | Surface to human |

## Safety Limits
- Max iterations: **50**
- Max consecutive errors: **3** (circuit breaker)
- Max files modified: **5** (ask human)
- Max tokens per request: **8000**

## Script Map
| Script | What it does |
|---|---|
| `harness.js` | Main orchestration engine |
| `tool-registry.js` | Tool catalog + skill discovery |
| `policy-engine.js` | PreToolUse permission checks |
| `state-manager.js` | Session persistence |
| `error-handler.js` | Structured error categorization |
| `safety-monitor.js` | Circuit breaker + limits |
| `orchestrate.js` | Agent matching from data/agents.csv |
| `build.js` | CCAP prompt assembly |
| `search.js` | Skill + template lookup |
| `validate.js` | Prompt quality + safety check |
