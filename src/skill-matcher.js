/**
 * Skill Matcher
 * Matches tasks to skills, builds agent councils, task boards, and designer rubrics.
 */

function analyzeTask(task) {
  const lower = task.toLowerCase();
  const domains = [];
  const add = (domain, skill, priority = 'medium') => {
    const key = `${domain}:${skill}`;
    if (domains.some(d => `${d.domain}:${d.skill}` === key)) return;
    domains.push({ domain, skill, priority });
  };

  if (/admin|dashboard|analytics|kpi|widget|mui|vuexy|table|chart/.test(lower)) {
    add('admin-ui', 'enterprise-ui-architect', 'high');
  }
  if (/design|ui|ux|style|css|layout|theme|color|font|responsive|visual|screen/.test(lower)) {
    add('ui-ux', 'ui-ux-pro-max', 'high');
    add('design-polish', 'emil-design-eng', 'high');
  }
  if (/react|next|component|page|tsx|jsx|frontend|hook|context|dashboard/.test(lower)) {
    add('frontend-code', 'frontend-patterns', 'high');
  }
  if (/ios|swift|swiftui|xcode|iphone|ipad|visionos|watchos|macos/.test(lower)) {
    add('ios-swift', 'build-ios-apps:swiftui-ui-patterns', 'high');
    add('ios-qa', 'build-ios-apps:ios-debugger-agent', 'high');
  }
  if (/android|kotlin|jetpack|compose|gradle|apk|emulator/.test(lower)) {
    add('android-kotlin', 'test-android-apps:android-emulator-qa', 'high');
    add('android-performance', 'test-android-apps:android-performance', 'medium');
  }
  if (/flutter|dart/.test(lower)) {
    add('flutter-dart', 'find-skills', 'high');
  }
  if (/react native|react-native|expo/.test(lower)) {
    add('react-native', 'find-skills', 'high');
  }
  if (/desktop|electron|tauri|native app|cli|command line|terminal/.test(lower)) {
    add('desktop-cli', 'find-skills', 'medium');
  }
  if (/ai|llm|rag|agent|openai|model|embedding|vector/.test(lower)) {
    add('ai-app', 'openai-docs', 'high');
  }
  if (/java|spring|boot|backend|api|controller|service|repository/.test(lower)) {
    add('backend-code', 'springboot-patterns', 'high');
  }
  if (/laravel|php/.test(lower)) {
    add('php-backend', 'find-skills', 'high');
  }
  if (/python|fastapi|django|flask/.test(lower)) {
    add('python-backend', 'find-skills', 'high');
  }
  if (/go|golang/.test(lower)) {
    add('go-backend', 'find-skills', 'high');
  }
  if (/rust|cargo/.test(lower)) {
    add('rust-backend', 'find-skills', 'high');
  }
  if (/test|spec|jest|junit|mock|coverage|verify|confirm|working|qa/.test(lower)) {
    add('verification', 'verification-loop', 'high');
    add('browser-qa', 'browser-qa', 'high');
  }
  if (/security|auth|jwt|cors|xss|sql|inject/.test(lower)) {
    add('security', 'springboot-security', 'high');
  }
  if (/database|db|migration|schema|sql|postgres|mongo|redis|prisma/.test(lower)) {
    add('database', 'database-migrations', 'medium');
  }
  if (/performance|slow|optimize|cache|memory|cpu|lag|bundle/.test(lower)) {
    add('performance', 'frontend-patterns', 'medium');
  }
  if (/refactor|clean|debt|smell|extract|decouple/.test(lower)) {
    add('refactoring', 'java-code-review', 'medium');
  }

  if (domains.length === 0) {
    add('general', 'frontend-patterns', 'medium');
  }

  // Complexity heuristic based on domain count + task indicators
  const domainCount = domains.length;
  const hasMultiplePlatforms = /and|plus|\+|with|integrate|between/.test(lower);
  const hasArchitecturalTerms = /architecture|hexagonal|domain|event sourcing|microservice/.test(lower);
  const hasLargeScope = /all|every|entire|full|whole|complete/.test(lower);

  let complexity = 'Low';
  if (domainCount >= 4 || hasArchitecturalTerms || (hasMultiplePlatforms && domainCount >= 2)) {
    complexity = 'High';
  } else if (domainCount >= 2 || hasLargeScope) {
    complexity = 'Medium';
  }

  const agentCount = Math.min(domains.filter(d => d.priority === 'high').length + 1, 6);

  return { domains, complexity, agentCount };
}

function getSkillInvocationPlan(task, template, domains, platforms = []) {
  const lower = task.toLowerCase();
  const plan = [];
  const add = (skill, reason, instruction) => {
    if (plan.some(item => item.skill === skill)) return;
    plan.push({ skill, reason, instruction });
  };

  add(
    'find-skills',
    'discover newer or more specialized skills beyond the local hardcoded list',
    'Run this before domain work. Search local installed skills first, then use the open skills ecosystem search when network/tooling is available. If a better skill exists, recommend installing/loading it and rerunning the task with that skill.'
  );

  for (const platform of platforms) {
    for (const skill of platform.defaultSkills) {
      add(
        skill,
        `${platform.label} specialist workflow`,
        `Use this for ${platform.label}. Expected evidence: ${platform.evidence}. If unavailable, search for a better ${platform.label} skill before continuing.`
      );
    }
  }

  if (/admin|dashboard|analytics|kpi|widget|mui|vuexy|table|chart/.test(lower)) {
    add(
      'enterprise-ui-architect',
      'admin dashboard structure, MUI/Vuexy composition, enterprise density, tables/cards/charts',
      'Load this first. Use it to judge layout hierarchy, dashboard information architecture, MUI component discipline, and Vuexy-style admin polish without adding Vuexy as a dependency.'
    );
  }

  if (/design|ui|ux|style|layout|theme|visual|responsive|dashboard|page|screen/.test(lower)) {
    add(
      'ui-ux-pro-max',
      'professional visual design system, spacing rhythm, palette, typography, UX anti-patterns',
      'Run the design-system/search workflow for the product surface, then use the results as the visual audit rubric. Do not rely on personal taste only.'
    );
    add(
      'emil-design-eng',
      'micro-polish and interaction feel',
      'Run a designer-eye pass for alignment, motion restraint, affordances, density, empty/loading/error states, and anything that feels cheap or unfinished.'
    );
  }

  if (/react|next|tsx|frontend|component|hook|context|dashboard|page|screen/.test(lower)) {
    add(
      'frontend-patterns',
      'Next.js/component architecture, hooks, state, i18n, and client/server boundaries',
      'Use it to inspect the actual route, component tree, data hooks, API client, and locale files before making any judgment.'
    );
  }

  if (template === 'audit' || /review|audit|check|confirm|verify|qa|working|all working/.test(lower)) {
    add(
      'browser-qa',
      'runtime UI proof through browser screenshots, console, network, and responsive checks',
      'Use browser automation on desktop and mobile. Capture light/dark screenshots when themes exist; verify console and network instead of guessing.'
    );
    add(
      'verification-loop',
      'static gates and final verification evidence',
      'Run available typecheck, lint, build, and tests. If a gate cannot run, report the blocker exactly.'
    );
  }

  if (/security|auth|jwt|cors|xss|csrf|permission/.test(lower)) {
    add(
      'security-review',
      'security and authorization review',
      'Use it for auth, authorization, sensitive data, XSS/CSRF, and unsafe frontend exposure checks.'
    );
  }

  for (const domain of domains) {
    add(
      domain.skill,
      `${domain.domain} coverage`,
      `Use this skill for the ${domain.domain} pass if it is available in the environment.`
    );
  }

  return plan;
}

function getSkillSearchQueries(task, domains, platforms = []) {
  const lower = task.toLowerCase();
  const queries = new Set();

  if (/admin|dashboard|analytics|kpi|widget|table|chart/.test(lower)) {
    queries.add('enterprise admin dashboard ui review');
    queries.add('dashboard design system charts tables');
  }
  if (/design|ui|ux|visual|layout|responsive|page|screen/.test(lower)) {
    queries.add('ui ux design review');
    queries.add('frontend visual design polish');
  }
  if (/react|next|tsx|frontend/.test(lower)) {
    queries.add('nextjs react frontend best practices');
  }
  if (/test|qa|verify|confirm|working|browser/.test(lower)) {
    queries.add('browser qa playwright verification');
  }
  if (/security|auth|permission|jwt|xss|csrf/.test(lower)) {
    queries.add('security review auth frontend');
  }

  for (const platform of platforms) {
    queries.add(`${platform.label} expert skill`);
    queries.add(`${platform.label} testing review best practices`);
  }

  for (const domain of domains) {
    queries.add(domain.domain.replace(/-/g, ' '));
  }

  if (queries.size === 0) queries.add(task);
  return [...queries].slice(0, 6);
}

function getSkillDiscoveryProtocol(task, domains, platforms = []) {
  const queries = getSkillSearchQueries(task, domains, platforms);
  return [
    'Purpose: do not rely only on the prompt-builder hardcoded skill list. Discover whether a newer, more specialized skill exists before doing the work.',
    'Step 1 — Local scan: inspect available skill metadata in .claude/skills, .codex/skills, .agents/skills, and globally installed skill folders. Match by name and description, not by filename only.',
    'Step 2 — Ecosystem scan: invoke the find-skills workflow. If CLI/network is available, run npx skills find with the queries below.',
    ...queries.map(query => `Search query: npx skills find "${query}"`),
    'Step 3 — Quality gate: prefer official or reputable sources, high install counts, clear SKILL.md instructions, and direct task fit. Do not recommend a random low-signal skill just because it appears in search.',
    'Step 4 — Recommendation: if a better skill is found, stop and recommend: install command, why it is better, and the exact prompt command to rerun after /reload-skills.',
    'Step 5 — Fallback: if no better skill is found or install is not approved, continue with the best installed skills listed below and explicitly say discovery found no stronger option.',
  ];
}

function getAgentCouncil(task, mode) {
  const lower = task.toLowerCase();
  const agents = [];
  const add = (name, mission, output) => agents.push({ name, mission, output });

  if (/design|ui|ux|dashboard|page|screen|visual|layout/.test(lower)) {
    add(
      'Lead Product Designer',
      'Judge whether the screen feels professional, coherent, and useful at first glance.',
      'Visual hierarchy, spacing rhythm, typography, density, contrast, empty/loading/error state quality, and top 5 design fixes.'
    );
    add(
      'Enterprise UI Architect',
      'Check admin/dashboard composition against MUI/Vuexy-style enterprise patterns.',
      'Layout map, widget priority, card/table/chart quality, token usage, and component-system violations.'
    );
  }

  add(
    'Frontend Code Reviewer',
    'Trace actual files, hooks, API calls, i18n keys, and state boundaries.',
    'File:line findings, broken assumptions, missing states, risky code paths, and scoped fix plan.'
  );

  if (mode === 'audit' || /review|audit|verify|confirm|working|qa/.test(lower)) {
    add(
      'Browser QA Engineer',
      'Prove runtime behavior with browser evidence.',
      'URLs, viewports, screenshots, console errors, failed requests, responsive overflow, and interaction results.'
    );
    add(
      'Verification Engineer',
      'Run static gates and summarize pass/fail truthfully.',
      'Commands run, pass/fail status, blockers, and residual risk.'
    );
  }

  if (mode === 'security-review' || /security|auth|jwt|xss|csrf/.test(lower)) {
    add(
      'Security Auditor',
      'Review auth, authorization, secrets, XSS/CSRF, and data exposure.',
      'Risk findings with CWE reference, reproduction steps, and fix priority.'
    );
  }

  if (mode === 'performance-review' || /performance|slow|optimize|lag/.test(lower)) {
    add(
      'Performance Engineer',
      'Profile hot paths and measure before/after.',
      'Baseline metrics, profiler evidence, optimization recommendation, post-fix measurements.'
    );
  }

  if (mode === 'architecture-review' || /architecture|hexagonal|clean|domain/.test(lower)) {
    add(
      'System Architect',
      'Map boundaries, coupling, cohesion, and dependency direction.',
      'Architecture map, coupling issues, dependency violations, restructure recommendation.'
    );
  }

  return agents;
}

function getUniversalAgentRoster(task, mode, platforms = []) {
  const agents = [];
  const add = (role, owns, when, deliverable) => {
    if (agents.some(agent => agent.role === role)) return;
    agents.push({ role, owns, when, deliverable });
  };

  add(
    'Coordinator / Tech Lead',
    'task decomposition, dependency graph, conflict boundaries, final synthesis',
    'always',
    'task board, agent assignment table, merged decision log, final verdict'
  );
  add(
    'Skill Scout',
    'local and ecosystem skill discovery before execution',
    'always',
    'skills searched, install/load recommendations, rerun command'
  );

  for (const platform of platforms) {
    if (platform.id === 'web') {
      add('Frontend/Web Agent', 'routes, components, UI state, browser behavior', 'web/frontend tasks', 'file findings, UI fixes, browser evidence');
      add('Product/UI Designer Agent', 'visual hierarchy, layout, typography, responsive polish', 'visual/product tasks', 'designer rubric findings and top design fixes');
    }
    if (platform.id === 'backend') {
      add('Backend/API Agent', 'controllers/services/repositories/contracts', 'backend/API tasks', 'endpoint flow, tests, contract risks');
      add('Data/DB Agent', 'schema, migrations, query correctness, persistence', 'database tasks', 'schema impact and data safety report');
    }
    if (platform.id === 'ios') {
      add('iOS/Swift Agent', 'SwiftUI/UIKit structure, Xcode build, simulator behavior', 'iOS tasks', 'Swift/Xcode findings, simulator screenshots/logs');
    }
    if (platform.id === 'android') {
      add('Android/Kotlin Agent', 'Kotlin/Compose structure, Gradle build, emulator behavior', 'Android tasks', 'Kotlin/Gradle findings, emulator screenshots/logcat');
    }
    if (platform.id === 'flutter') {
      add('Flutter/Dart Agent', 'Flutter widget tree, state, platform behavior', 'Flutter tasks', 'flutter analyze/test findings and device evidence');
    }
    if (platform.id === 'react-native') {
      add('React Native Agent', 'RN/Expo screens, native platform differences, Metro flow', 'React Native tasks', 'cross-platform findings and screenshots');
    }
    if (platform.id === 'desktop') {
      add('Desktop App Agent', 'desktop shell/window states, native integrations, packaging constraints', 'desktop tasks', 'runtime behavior and OS integration report');
    }
    if (platform.id === 'cli') {
      add('CLI/Tooling Agent', 'commands, flags, help output, exit codes, fixtures', 'CLI/tooling tasks', 'command transcript and edge-case report');
    }
    if (platform.id === 'devops') {
      add('DevOps/Release Agent', 'build/deploy pipeline, env vars, rollback, logs', 'deployment tasks', 'release risk and verification report');
    }
    if (platform.id === 'ai') {
      add('AI/LLM Agent', 'model calls, prompt/data flow, evals, persistence, safety', 'AI/RAG/agent tasks', 'AI flow map, eval cases, risk/cost report');
    }
    if (platform.id === 'laravel') {
      add('Laravel/PHP Agent', 'routes, controllers, Eloquent, Blade, artisan commands', 'Laravel tasks', 'Laravel structure findings and test evidence');
    }
    if (platform.id === 'python') {
      add('Python Agent', 'FastAPI/Django/Flask handlers, ORM, pytest, mypy', 'Python tasks', 'Python structure findings and test evidence');
    }
    if (platform.id === 'go') {
      add('Go Agent', 'handlers, storage, go test, benchmark', 'Go tasks', 'Go module findings and test evidence');
    }
    if (platform.id === 'rust') {
      add('Rust Agent', 'crate structure, async, cargo test/clippy', 'Rust tasks', 'Rust findings and safety evidence');
    }
    if (platform.id === 'dotnet') {
      add('.NET Agent', 'controllers, EF Core, xUnit, Blazor', '.NET tasks', '.NET structure findings and test evidence');
    }
    if (platform.id === 'unity') {
      add('Unity Agent', 'scenes, scripts, build targets, profiler', 'Game dev tasks', 'Unity findings and play-mode evidence');
    }
    if (platform.id === 'data-ml') {
      add('Data/ML Agent', 'pipelines, models, evals, reproducibility', 'Data/ML tasks', 'ML findings and metric evidence');
    }
    if (platform.id === 'db') {
      add('Database Agent', 'schema, migrations, query plans, indexing', 'Database tasks', 'DB findings and performance evidence');
    }
  }

  add(
    'QA/Verification Agent',
    'static gates, runtime proof, regression checks, screenshots/logs',
    mode === 'audit' ? 'audit/review tasks' : 'after implementation',
    'commands run, pass/fail gates, blockers, residual risk'
  );

  return agents;
}

function getMulticaStyleTaskBoard(task, mode, platforms = []) {
  const taskType = ['audit', 'bugfix', 'refactor'].includes(mode) ? mode : 'implementation';

  const cards = [
    {
      id: 'T0',
      owner: 'Coordinator / Tech Lead',
      title: 'Normalize request and define task graph',
      status: 'todo',
      dependsOn: 'none',
      artifact: 'task understanding, scope, platform map, stop conditions',
    },
    {
      id: 'T1',
      owner: 'Skill Scout',
      title: 'Discover local and ecosystem skills',
      status: 'todo',
      dependsOn: 'T0',
      artifact: 'skill search report and install/load recommendations',
    },
  ];

  platforms.forEach((platform, index) => {
    if (platform.isIntegrationLane) {
      cards.push({
        id: `I1`,
        owner: `${platform.label} Agent`,
        title: `Cross-platform integration verification`,
        status: 'todo',
        dependsOn: platforms.filter(p => !p.isIntegrationLane).map((_, i) => `P${i + 1}`).join(', '),
        artifact: platform.evidence,
      });
    } else {
      cards.push({
        id: `P${index + 1}`,
        owner: `${platform.label} Agent`,
        title: `${taskType} pass for ${platform.label}`,
        status: 'todo',
        dependsOn: 'T1',
        artifact: platform.evidence,
      });
    }
  });

  cards.push(
    {
      id: 'Q1',
      owner: 'QA/Verification Agent',
      title: 'Run verification gates and collect runtime evidence',
      status: 'todo',
      dependsOn: platforms.length ? platforms.filter(p => !p.isIntegrationLane).map((_, index) => `P${index + 1}`).join(', ') : 'T1',
      artifact: 'commands, screenshots/logs, console/network or platform runtime evidence',
    },
    {
      id: 'S1',
      owner: 'Coordinator / Tech Lead',
      title: 'Synthesize findings and produce final answer',
      status: 'todo',
      dependsOn: 'Q1',
      artifact: 'final verdict, prioritized issues, next tasks, residual risk',
    }
  );

  return cards;
}

function getDesignerRubric(task) {
  const lower = task.toLowerCase();
  if (!/design|ui|ux|dashboard|page|screen|visual|layout|admin|component|card/.test(lower)) return [];

  return [
    'First-glance clarity: can a real user understand the page purpose and next action in 5 seconds?',
    'Hierarchy: primary metrics/actions are visually dominant; secondary content does not compete.',
    'Spacing rhythm: grids, cards, filters, and tables align to a consistent spacing system.',
    'Typography: headings, labels, numbers, helper text, and table text have clear scale and weight.',
    'Color discipline: semantic status colors and theme tokens only; no random hex/alpha soup.',
    'Interaction quality: hover, focus, disabled, loading, empty, error, and selected states feel intentional.',
    'Responsive behavior: 375px, 768px, 1024px, and 1440px have no overlap, clipping, or horizontal scroll.',
    'Dark/light parity: both schemes preserve contrast, surfaces, borders, shadows, and chart readability.',
    'Accessibility: WCAG AA contrast, keyboard navigation, screen reader labels, focus visibility.',
    'Enterprise polish: the page feels like a production admin/product tool, not a generated demo.',
  ];
}

module.exports = {
  analyzeTask,
  getSkillInvocationPlan,
  getSkillSearchQueries,
  getSkillDiscoveryProtocol,
  getAgentCouncil,
  getUniversalAgentRoster,
  getMulticaStyleTaskBoard,
  getDesignerRubric,
};
