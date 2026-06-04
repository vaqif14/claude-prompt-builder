#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const POLICIES = [
  {
    name: 'scope-gate',
    check: (toolName, params, state) => {
      const allowedPaths = ['src/', 'tests/', 'docs/', 'config/'];
      const target = params.file_path || params.path || params.file || '';
      if (!target) return { allowed: true };
      const isAllowed = allowedPaths.some(p => target.includes(p)) || target.startsWith('.claude/');
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Path "${target}" is outside allowed scope. Allowed: ${allowedPaths.join(', ')}`,
          errorCategory: 'permission'
        };
      }
      return { allowed: true };
    }
  },
  {
    name: 'destructive-review',
    check: (toolName, params, state) => {
      if (toolName === 'write' || toolName === 'edit') {
        const modifiedCount = state.filesModified?.length || 0;
        if (modifiedCount >= 5) {
          return {
            allowed: false,
            reason: `Destructive action blocked: already modified ${modifiedCount} files. Human approval required.`,
            errorCategory: 'permission',
            actionRequired: 'escalate_to_human'
          };
        }
      }
      return { allowed: true };
    }
  },
  {
    name: 'iteration-limit',
    check: (toolName, params, state) => {
      if (state.iteration >= 50) {
        return {
          allowed: false,
          reason: 'Iteration limit (50) exceeded. Escalating to human.',
          errorCategory: 'internal',
          actionRequired: 'escalate_to_human'
        };
      }
      return { allowed: true };
    }
  },
  {
    name: 'verification-gate',
    check: (toolName, params, state) => {
      const gatedTools = ['process_refund', 'lookup_order', 'delete'];
      if (gatedTools.includes(toolName) && !state.verified) {
        return {
          allowed: false,
          reason: `Tool "${toolName}" requires verification. Call get_customer first.`,
          errorCategory: 'validation',
          requiredTool: 'get_customer'
        };
      }
      return { allowed: true };
    }
  }
];

function applyPolicies(toolName, params, state) {
  for (const policy of POLICIES) {
    const result = policy.check(toolName, params, state);
    if (!result.allowed) {
      return {
        allowed: false,
        policy: policy.name,
        ...result
      };
    }
  }
  return { allowed: true };
}

function addPolicy(name, checkFn) {
  POLICIES.push({ name, check: checkFn });
}

if (require.main === module) {
  const toolName = process.argv[2] || 'write';
  const filePath = process.argv[3] || 'src/test.ts';
  const state = {
    iteration: 10,
    verified: true,
    filesModified: ['src/a.ts', 'src/b.ts']
  };
  const result = applyPolicies(toolName, { file_path: filePath }, state);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { applyPolicies, addPolicy, POLICIES };
