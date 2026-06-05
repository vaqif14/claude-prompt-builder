/**
 * Prompt Builder — Main Entry Point (Thin Orchestrator)
 * All logic lives in domain-specific modules:
 *   - platform-detector: platform/stack detection, mixed lanes
 *   - mode-router: mode inference, mode configs
 *   - skill-matcher: skill mapping, agent councils, task boards
 *   - prompt-assembler: prompt generation and assembly
 */

const { generatePrompt, parseRows, inferTaskUnderstanding } = require('./prompt-assembler');
const { searchData } = require('../scripts/search');
const { validatePrompt } = require('../scripts/validate');

// Re-export submodules for advanced consumers
const platformDetector = require('./platform-detector');
const modeRouter = require('./mode-router');
const skillMatcher = require('./skill-matcher');
const stackCache = require('./stack-cache');
const modelRouter = require('./model-router');

module.exports = {
  generatePrompt,
  searchData,
  validatePrompt,
  parseRows,
  inferTaskUnderstanding,
  // Submodules
  platformDetector,
  modeRouter,
  skillMatcher,
  stackCache,
  // Model router
  selectModel: modelRouter.selectModel,
  inferComplexity: modelRouter.inferComplexity,
  // Backward-compatible direct exports
  detectPlatforms: platformDetector.detectPlatforms,
  detectPlatformsMixed: platformDetector.detectPlatformsMixed,
  detectStack: platformDetector.detectStack,
  inferMode: modeRouter.inferMode,
  getModeConfig: modeRouter.getModeConfig,
  listModes: modeRouter.listModes,
  analyzeTask: skillMatcher.analyzeTask,
  getSkillInvocationPlan: skillMatcher.getSkillInvocationPlan,
  getSkillSearchQueries: skillMatcher.getSkillSearchQueries,
  getAgentCouncil: skillMatcher.getAgentCouncil,
  getUniversalAgentRoster: skillMatcher.getUniversalAgentRoster,
  getMulticaStyleTaskBoard: skillMatcher.getMulticaStyleTaskBoard,
  getDesignerRubric: skillMatcher.getDesignerRubric,
  ensureStackProfile: stackCache.ensureStackProfile,
  getStackProfilePath: stackCache.getStackProfilePath,
  scanInstalledSkills: stackCache.scanInstalledSkills,
};
