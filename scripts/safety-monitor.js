#!/usr/bin/env node
const { updateState, logAudit } = require('./state-manager');

const SAFETY_CONFIG = {
  maxIterations: 50,
  maxConsecutiveErrors: 3,
  maxFilesModified: 5,
  maxTokensPerRequest: 8000
};

class SafetyMonitor {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.consecutiveErrors = 0;
    this.iterationCount = 0;
  }

  checkIterationLimit() {
    this.iterationCount++;
    updateState(this.sessionId, { iteration: this.iterationCount });
    
    if (this.iterationCount >= SAFETY_CONFIG.maxIterations) {
      const msg = `SAFETY: Iteration limit (${SAFETY_CONFIG.maxIterations}) exceeded. Stopping.`;
      logAudit(msg, this.sessionId);
      return { safe: false, reason: msg, action: 'escalate_to_human' };
    }
    return { safe: true };
  }

  checkCircuitBreaker(errorCategory) {
    if (errorCategory === 'transient') {
      this.consecutiveErrors++;
    } else {
      this.consecutiveErrors = 0;
    }
    
    if (this.consecutiveErrors >= SAFETY_CONFIG.maxConsecutiveErrors) {
      const msg = `SAFETY: Circuit breaker triggered after ${this.consecutiveErrors} consecutive errors.`;
      logAudit(msg, this.sessionId);
      return { safe: false, reason: msg, action: 'escalate_to_human' };
    }
    return { safe: true };
  }

  checkFileLimit(state) {
    const modified = state.filesModified?.length || 0;
    if (modified >= SAFETY_CONFIG.maxFilesModified) {
      const msg = `SAFETY: File modification limit (${SAFETY_CONFIG.maxFilesModified}) reached.`;
      logAudit(msg, this.sessionId);
      return { safe: false, reason: msg, action: 'ask_human' };
    }
    return { safe: true };
  }

  checkAll(state, errorCategory = null) {
    const checks = [
      this.checkIterationLimit(),
      errorCategory ? this.checkCircuitBreaker(errorCategory) : { safe: true },
      this.checkFileLimit(state)
    ];
    
    for (const check of checks) {
      if (!check.safe) return check;
    }
    return { safe: true };
  }

  reset() {
    this.consecutiveErrors = 0;
    this.iterationCount = 0;
  }
}

function shouldEscalate(errorCategory, iterationCount, consecutiveErrors) {
  if (errorCategory === 'permission') return true;
  if (iterationCount >= SAFETY_CONFIG.maxIterations) return true;
  if (consecutiveErrors >= SAFETY_CONFIG.maxConsecutiveErrors) return true;
  return false;
}

if (require.main === module) {
  const monitor = new SafetyMonitor('test');
  console.log('Safety config:', SAFETY_CONFIG);
  console.log('Test check:', monitor.checkAll({ filesModified: [] }));
}

module.exports = { SafetyMonitor, shouldEscalate, SAFETY_CONFIG };
