/**
 * Model Router
 * Complexity-based model selection for agent tasks.
 */

const LOW_KEYWORDS = ['find', 'search', 'read', 'grep', 'locate'];
const HIGH_KEYWORDS = ['architecture', 'design', 'security', 'migrate', 'refactor large'];

function inferComplexity(task) {
  const lower = (task || '').toLowerCase();

  if (LOW_KEYWORDS.some(k => lower.includes(k))) {
    return 'Low';
  }
  if (HIGH_KEYWORDS.some(k => lower.includes(k))) {
    return 'High';
  }

  // Scope heuristics
  const hasLargeScope = /all|every|entire|full|whole|complete|5\+|five or more/.test(lower);
  const hasArchitecturalTerms = /hexagonal|domain|event sourcing|microservice/.test(lower);
  const hasRefactor = /refactor/.test(lower);
  const hasFeature = /implement|feature|add|create|build/.test(lower);

  if (hasLargeScope || hasArchitecturalTerms) {
    return 'High';
  }
  if (hasRefactor || hasFeature) {
    return 'Medium';
  }

  return 'Medium';
}

function selectModel(task, complexity, options = {}) {
  // CLI override takes highest precedence
  if (options && options.model) {
    return options.model;
  }

  const effectiveComplexity = complexity || inferComplexity(task);

  switch (effectiveComplexity) {
    case 'Low':
      return 'haiku';
    case 'High':
      return 'opus';
    case 'Medium':
    default:
      return 'sonnet';
  }
}

module.exports = {
  inferComplexity,
  selectModel,
};
