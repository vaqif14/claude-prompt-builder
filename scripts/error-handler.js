#!/usr/bin/env node

const ERROR_CATEGORIES = {
  TRANSIENT: 'transient',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  INTERNAL: 'internal'
};

function categorizeError(error) {
  if (error instanceof TimeoutError || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
    return {
      category: ERROR_CATEGORIES.TRANSIENT,
      isRetryable: true,
      retryAfterMs: 2000,
      description: `Timeout/connection error: ${error.message}`
    };
  }
  if (error instanceof PermissionError || error.code === 'EACCES' || error.code === 'EPERM') {
    return {
      category: ERROR_CATEGORIES.PERMISSION,
      isRetryable: false,
      description: `Access denied: ${error.message}`
    };
  }
  if (error instanceof TypeError || error instanceof RangeError || error.name === 'ValidationError') {
    return {
      category: ERROR_CATEGORIES.VALIDATION,
      isRetryable: false,
      description: `Invalid input: ${error.message}`
    };
  }
  return {
    category: ERROR_CATEGORIES.INTERNAL,
    isRetryable: false,
    description: `Unexpected error: ${error.message}`
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
