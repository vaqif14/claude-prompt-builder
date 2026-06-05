#!/usr/bin/env node

const ERROR_CATEGORIES = {
  TRANSIENT: 'transient',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  INTERNAL: 'internal'
};

function categorizeError(error) {
  const code = error && error.code;
  const name = error && error.name;
  const message = String((error && error.message) || '');

  if (name === 'TimeoutError' || code === 'ETIMEDOUT' || code === 'ECONNRESET' || /timeout|timed out/i.test(message)) {
    return {
      category: ERROR_CATEGORIES.TRANSIENT,
      isRetryable: true,
      retryAfterMs: 2000,
      description: `Timeout/connection error: ${message}`
    };
  }
  if (name === 'PermissionError' || code === 'EACCES' || code === 'EPERM' || /permission denied|access denied/i.test(message)) {
    return {
      category: ERROR_CATEGORIES.PERMISSION,
      isRetryable: false,
      description: `Access denied: ${message}`
    };
  }
  if (error instanceof TypeError || error instanceof RangeError || name === 'ValidationError') {
    return {
      category: ERROR_CATEGORIES.VALIDATION,
      isRetryable: false,
      description: `Invalid input: ${message}`
    };
  }
  return {
    category: ERROR_CATEGORIES.INTERNAL,
    isRetryable: false,
    description: `Unexpected error: ${message}`
  };
}

function createErrorResponse(error, toolName) {
  const categorized = categorizeError(error);
  return {
    type: 'tool_result',
    tool_use_id: toolName,
    is_error: true,
    content: JSON.stringify({
      errorCategory: categorized.category,
      isRetryable: categorized.isRetryable,
      description: categorized.description,
      retryAfterMs: categorized.retryAfterMs || null,
      tool: toolName
    })
  };
}

async function withRetry(fn, maxRetries = 3, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const categorized = categorizeError(error);
      if (!categorized.isRetryable || attempt >= maxRetries) {
        throw error;
      }
      console.log(`  [RETRY] Attempt ${attempt}/${maxRetries} failed (${categorized.category}). Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      delayMs *= 2; // exponential backoff
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  // Test
  const testErrors = [
    new Error('Connection timeout'),
    new Error('Permission denied'),
    new TypeError('Invalid parameter'),
    new Error('Something went wrong')
  ];
  for (const err of testErrors) {
    console.log(categorizeError(err));
  }
}

module.exports = { categorizeError, createErrorResponse, withRetry, ERROR_CATEGORIES, sleep };
