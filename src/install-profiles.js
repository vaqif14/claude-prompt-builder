/**
 * Selective Install Profiles
 * Curated, capped skill/tool recommendations per project shape. The ecosystem trend is
 * mega-setups with dozens of skills/agents/hooks/MCP servers — but bulk install is the wrong
 * default for token cost and reliability. A profile recommends a SMALL set and explains why
 * each item is included. Installs are always recommendations; the acting agent must ask first.
 */

// Cap so a profile never balloons into a mega-setup.
const MAX_ITEMS = 6;

const PROFILES = {
  web: {
    label: 'Web / Frontend',
    items: [
      { name: 'frontend-patterns', why: 'component architecture, state, data-fetching conventions' },
      { name: 'ui-ux-pro-max', why: 'visual/style-contract review and design tokens' },
      { name: 'browser-qa', why: 'runtime UI verification (screenshots, console, network)' },
      { name: 'web-design-guidelines', why: 'accessibility + interface-guidelines audit' },
      { name: 'verification-loop', why: 'typecheck/lint/test/build gates' },
    ],
  },
  backend: {
    label: 'Backend / API',
    items: [
      { name: 'backend-patterns', why: 'service/repo layering, transactions, error strategy' },
      { name: 'api-design', why: 'contract/DTO and endpoint-shape review' },
      { name: 'database-reviewer', why: 'query/schema/migration safety' },
      { name: 'security-review', why: 'authz/authn, input validation, secret handling' },
      { name: 'verification-loop', why: 'build/test gates with real command evidence' },
    ],
  },
  mobile: {
    label: 'Mobile (iOS / Android / cross-platform)',
    items: [
      { name: 'swiftui-patterns', why: 'iOS/SwiftUI idioms (swap for kotlin/flutter as needed)' },
      { name: 'android-clean-architecture', why: 'Android layering + Compose state' },
      { name: 'accessibility', why: 'mobile a11y: labels, contrast, dynamic type' },
      { name: 'e2e-testing', why: 'device/simulator runtime verification' },
    ],
  },
  'ai-agent': {
    label: 'AI / Agent app',
    items: [
      { name: 'mcp-server-patterns', why: 'tool-as-contract design, namespacing, token-efficient returns' },
      { name: 'eval-harness', why: 'offline/online eval before shipping prompt/agent changes' },
      { name: 'agentic-engineering', why: 'workflow patterns: routing/chaining/orchestrator-workers' },
      { name: 'cost-tracking', why: 'token/cost budgeting for LLM pipelines' },
      { name: 'security-review', why: 'prompt-injection and tool-permission boundaries' },
    ],
  },
  hackathon: {
    label: 'Hackathon / Demo MVP',
    items: [
      { name: 'frontend-design-direction', why: 'make the demo look production-real fast' },
      { name: 'deploy-to-vercel', why: 'one-command live link for judges' },
      { name: 'browser-qa', why: 'verify the single demo happy-path does not crash' },
      { name: 'verification-loop', why: 'fast build/test gate before the demo' },
    ],
  },
};

/**
 * @param {string} key profile name
 * @returns {{label:string, items:Array<{name,why}>}|null}
 */
function getInstallProfile(key) {
  if (!key) return null;
  const p = PROFILES[String(key).toLowerCase()];
  if (!p) return null;
  return { label: p.label, items: p.items.slice(0, MAX_ITEMS) };
}

function listInstallProfiles() {
  return Object.keys(PROFILES);
}

module.exports = { getInstallProfile, listInstallProfiles, MAX_ITEMS, PROFILES };
