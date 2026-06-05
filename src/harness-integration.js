const { spawnAgent, preToolUse, postToolUse } = require('../scripts/harness');
const { checkPolicy } = require('../scripts/policy-engine');
const { saveSession, loadSession } = require('../scripts/state-manager');
const { generatePrompt } = require('./prompt-assembler');

function runWithHarness(promptText, options = {}) {
  const sessionId = options.sessionId || `harness_${Date.now()}`;

  // Load or initialize session state
  const state = loadSession(sessionId);

  // Run policy checks before generation
  const policyChecks = checkPolicy('generate', { task: promptText }, state);

  if (!policyChecks.allowed) {
    saveSession({ ...state, lastPolicyCheck: policyChecks, lastPrompt: promptText }, sessionId);
    return {
      prompt: null,
      policyChecks,
      sessionId,
    };
  }

  // Pre-generation hook
  const pre = preToolUse('generate', { task: promptText }, sessionId);
  if (!pre.allowed) {
    saveSession({ ...state, lastPreCheck: pre, lastPrompt: promptText }, sessionId);
    return {
      prompt: null,
      policyChecks: { ...policyChecks, preHookBlocked: pre.reason },
      sessionId,
    };
  }

  // Generate prompt
  const result = generatePrompt(promptText, options);

  // Post-generation hook
  postToolUse('generate', result, { task: promptText }, sessionId);

  // Update and save session state
  const updatedState = loadSession(sessionId);
  updatedState.lastPrompt = promptText;
  updatedState.lastGeneratedAt = new Date().toISOString();
  saveSession(updatedState, sessionId);

  return {
    prompt: result.prompt,
    policyChecks,
    sessionId,
  };
}

module.exports = { runWithHarness };
