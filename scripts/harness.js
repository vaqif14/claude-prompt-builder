#!/usr/bin/env node
const { loadState, saveState, updateState, logAudit } = require('./state-manager');
const { applyPolicies } = require('./policy-engine');
const { categorizeError, withRetry } = require('./error-handler');
const { getToolRegistry, findTool } = require('./tool-registry');
const { SafetyMonitor, shouldEscalate } = require('./safety-monitor');

class AgentHarness {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.state = loadState(sessionId);
    this.monitor = new SafetyMonitor(sessionId);
    this.registry = getToolRegistry();
    logAudit(`Harness initialized for session: ${sessionId}`, sessionId);
  }

  // PreToolUse: apply policies before execution
  preToolUse(toolName, params) {
    const tool = findTool(toolName);
    if (!tool) {
      return { allowed: false, reason: `Unknown tool: ${toolName}`, errorCategory: 'validation' };
    }
    
    const policyResult = applyPolicies(toolName, params, this.state);
    if (!policyResult.allowed) {
      logAudit(`POLICY BLOCKED: ${toolName} — ${policyResult.reason}`, this.sessionId);
      return policyResult;
    }
    
    const safetyResult = this.monitor.checkAll(this.state);
    if (!safetyResult.safe) {
      logAudit(`SAFETY BLOCKED: ${toolName} — ${safetyResult.reason}`, this.sessionId);
      return { allowed: false, ...safetyResult };
    }
    
    return { allowed: true, tool };
  }

  // PostToolUse: normalize output and update state
  postToolUse(toolName, rawResult, params) {
    // Update state
    if (toolName === 'write' || toolName === 'edit') {
      const filePath = params.file_path || params.path || '';
      if (filePath && !this.state.filesModified.includes(filePath)) {
        this.state.filesModified.push(filePath);
      }
    }
    
    this.state.iteration++;
    saveState(this.state, this.sessionId);
    
    logAudit(`TOOL EXECUTED: ${toolName} — ${JSON.stringify(rawResult).substring(0, 100)}`, this.sessionId);
    
    return rawResult;
  }

  // Execute tool with full harness wrapping
  async execute(toolName, params) {
    // PreToolUse
    const pre = this.preToolUse(toolName, params);
    if (!pre.allowed) {
      return {
        success: false,
        error: pre.reason,
        errorCategory: pre.errorCategory || 'permission',
        action: pre.actionRequired || 'escalate_to_human'
      };
    }
    
    try {
      // Actual execution (mock for now)
      const result = await this.mockExecute(toolName, params);
      
      // PostToolUse
      const normalized = this.postToolUse(toolName, result, params);
      
      return { success: true, result: normalized };
    } catch (error) {
      const categorized = categorizeError(error);
      
      // Check if should escalate
      if (shouldEscalate(categorized.category, this.state.iteration, this.monitor.consecutiveErrors)) {
        logAudit(`ESCALATED: ${toolName} — ${categorized.description}`, this.sessionId);
        return {
          success: false,
          error: categorized.description,
          errorCategory: categorized.category,
          action: 'escalate_to_human'
        };
      }
      
      return {
        success: false,
        error: categorized.description,
        errorCategory: categorized.category,
        isRetryable: categorized.isRetryable,
        retryAfterMs: categorized.retryAfterMs
      };
    }
  }

  // Mock execution for demonstration
  async mockExecute(toolName, params) {
    // In real implementation, this would call actual tools
    return { tool: toolName, params, executed: true, timestamp: new Date().toISOString() };
  }

  // Spawn a subagent
  async spawnAgent(description, prompt, agentType = 'explore', agentConfig = null) {
    // If agentConfig is passed, use it as the source of truth (new API)
    if (agentConfig && typeof agentConfig === 'object') {
      description = agentConfig.description || description;
      prompt = agentConfig.prompt || prompt;
      agentType = agentConfig.type || agentType;
    }
    const agentId = `agent_${Date.now()}`;
    
    logAudit(`AGENT SPAWNED: ${description} (${agentId})`, this.sessionId);
    
    this.state.agents[agentId] = {
      id: agentId,
      description,
      type: agentType,
      status: 'running',
      startedAt: new Date().toISOString()
    };
    saveState(this.state, this.sessionId);
    
    // In real implementation, this would call Agent()
    return {
      agentId,
      description,
      type: agentType,
      status: 'completed',
      result: `Agent ${description} completed analysis`
    };
  }

  // Main orchestration loop
  async runOrchestration(task, domains) {
    logAudit(`ORCHESTRATION STARTED: ${task}`, this.sessionId);
    
    const results = [];
    
    // Spawn agents in parallel
    const agentPromises = domains.map(domain => 
      this.spawnAgent(domain.skill, `${task} — ${domain.domain}`, domain.agentType)
    );
    
    const agents = await Promise.all(agentPromises);
    
    // Collect findings
    for (const agent of agents) {
      results.push({
        domain: agent.description,
        status: agent.status,
        result: agent.result
      });
    }
    
    // Aggregate
    this.state.findings = results;
    this.state.completed = true;
    saveState(this.state, this.sessionId);
    
    logAudit(`ORCHESTRATION COMPLETED: ${task}`, this.sessionId);
    
    return {
      task,
      agents: agents.length,
      findings: results,
      state: this.state
    };
  }

  getStatus() {
    return {
      sessionId: this.sessionId,
      iteration: this.state.iteration,
      filesModified: this.state.filesModified.length,
      agentsSpawned: Object.keys(this.state.agents).length,
      errors: this.state.errors.length,
      completed: this.state.completed
    };
  }
}

if (require.main === module) {
  async function main() {
    const harness = new AgentHarness('demo');
    
    console.log('=== Agent Harness Demo ===\n');
    console.log('Status:', harness.getStatus());
    
    // Test policy enforcement
    console.log('\n--- Testing Policy Engine ---');
    const blocked = harness.preToolUse('write', { file_path: '/etc/passwd' });
    console.log('Blocked write to /etc/passwd:', blocked.allowed === false ? '✅' : '❌');
    
    // Test tool execution
    console.log('\n--- Testing Tool Execution ---');
    const result = await harness.execute('read', { file_path: 'src/app.tsx' });
    console.log('Read result:', result.success ? '✅' : '❌');
    
    // Test orchestration
    console.log('\n--- Testing Orchestration ---');
    const domains = [
      { domain: 'ui-ux', skill: 'ui-ux-pro-max', agentType: 'explore' },
      { domain: 'frontend-code', skill: 'frontend-patterns', agentType: 'explore' }
    ];
    const orch = await harness.runOrchestration('design update for auction page', domains);
    console.log('Orchestration:', orch.agents, 'agents spawned');
    
    console.log('\nFinal Status:', harness.getStatus());
    console.log('\nState saved to:', `memory/${harness.sessionId}.json`);
  }
  
  main().catch(console.error);
}

// Standalone function wrappers for harness integration
function preToolUse(toolName, params, sessionId = 'default') {
  const harness = new AgentHarness(sessionId);
  return harness.preToolUse(toolName, params);
}

function postToolUse(toolName, rawResult, params, sessionId = 'default') {
  const harness = new AgentHarness(sessionId);
  return harness.postToolUse(toolName, rawResult, params);
}

function spawnAgent(agentConfig, sessionId = 'default') {
  const harness = new AgentHarness(sessionId);
  const { description = '', prompt = '', type = 'explore' } = agentConfig || {};
  return harness.spawnAgent(description, prompt, type, null);
}

module.exports = { AgentHarness, preToolUse, postToolUse, spawnAgent };
