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
  // Backward-compatible direct exports
  detectPlatforms: platformDetector.detectPlatforms,
  detectPlatformsMixed: platformDetector.detectPlatformsMixed,
  detectStack: platformDetector.detectStack,
  inferMode: modeRouter.inferMode,
  inferTemplate: modeRouter.inferTemplate,
  getModeConfig: modeRouter.getModeConfig,
  listModes: modeRouter.listModes,
  analyzeTask: skillMatcher.analyzeTask,
  getSkillInvocationPlan: skillMatcher.getSkillInvocationPlan,
  getAgentCouncil: skillMatcher.getAgentCouncil,
  getUniversalAgentRoster: skillMatcher.getUniversalAgentRoster,
  getMulticaStyleTaskBoard: skillMatcher.getMulticaStyleTaskBoard,
  getDesignerRubric: skillMatcher.getDesignerRubric,
};
