/**
 * Skill Matcher
 * Matches tasks to skills, builds agent councils, task boards, and designer rubrics.
 */

const { selectModel } = require('./model-router');
const { sanitizeShellArg } = require('./sanitize');

// Pick the skill an agent should own by TASK FIT, not by array position. A quality
// refactor of a Spring backend should bind springboot-patterns / java-code-review, not
// the positional-first api-design. Generic across every platform's defaultSkills list.
function pickPrimarySkill(defaultSkills, mode) {
  const skills = (defaultSkills || []).filter(Boolean);
  if (!skills.length) return 'find-skills';
  if (mode === 'security-review') {
    const sec = skills.find(s => /security/.test(s));
    if (sec) return sec;
  }
  if (['refactor', 'architecture-review', 'audit', 'performance-review'].includes(mode)) {
    const fit = skills.find(s => /patterns|review|standards|quality|concurrency/.test(s));
    if (fit) return fit;
  }
  return skills[0];
}

function analyzeTask(task) {
  const lower = task.toLowerCase();
  const domains = [];
  const add = (domain, skill, priority = 'medium') => {
    const key = `${domain}:${skill}`;
    if (domains.some(d => `${d.domain}:${d.skill}` === key)) return;
    domains.push({ domain, skill, priority });
  };

  if (/\b(?:admin|dashboard|analytics|kpi|widgets?|mui|tables?|charts?)\b/.test(lower)) {
    add('admin-ui', 'enterprise-ui-architect', 'high');
  }
  if (/\b(?:design|ui|ux|style|css|layout|theme|colou?r|font|responsive|visual|screen)\b/.test(lower)) {
    add('ui-ux', 'ui-ux-pro-max', 'high');
    add('design-polish', 'emil-design-eng', 'high');
  }
  if (/\b(?:react|reactjs|next|nextjs|components?|pages?|tsx|jsx|frontend|hooks?|context|dashboard)\b/.test(lower)) {
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
  if (/\b(?:ai|llm|rag|agent|openai|model|embedding|vector)\b/.test(lower)) {
    add('ai-app', 'openai-docs', 'high');
  }
  if (/\b(?:java|spring|boot)\b/.test(lower)) {
    add('java-backend', 'springboot-patterns', 'high');
  }
  if (/laravel|php/.test(lower)) {
    add('php-backend', 'find-skills', 'high');
  }
  if (/python|fastapi|django|flask/.test(lower)) {
    add('python-backend', 'find-skills', 'high');
  }
  if (/\bgolang\b|\bgo\b\s+(?:module|service|handler|backend|api|app)|\bgin\b|\bfiber\b/.test(lower)) {
    add('go-backend', 'find-skills', 'high');
  }
  if (/\b(?:rust|cargo)\b/.test(lower)) {
    add('rust-backend', 'find-skills', 'high');
  }
  if (/\b(?:express|node|nodejs)\b/.test(lower)) {
    add('node-backend', 'frontend-patterns', 'high');
  }
  if (/\bnestjs\b/.test(lower)) {
    add('nestjs-backend', 'find-skills', 'high');
  }
  if (/\.net|c#|asp\.net/.test(lower)) {
    add('dotnet-backend', 'find-skills', 'high');
  }
  if (/\b(?:rails|ruby)\b/.test(lower)) {
    add('ruby-backend', 'find-skills', 'high');
  }
  if (/\b(?:backend|api|server|controller|service|repository)\b/.test(lower)) {
    add('backend-code', 'springboot-patterns', 'high');
  }
  if (/\b(?:tests?|specs?|jest|junit|mock|coverage|verify|confirm|working|qa)\b/.test(lower)) {
    add('verification', 'verification-loop', 'high');
    add('browser-qa', 'browser-qa', 'high');
  }
  if (/\b(?:security|auth|jwt|cors|xss|sql|inject)\b/.test(lower)) {
    add('security', 'springboot-security', 'high');
  }
  if (/\b(?:database|db|migrations?|schema|sql)\b/.test(lower)) {
    add('database', 'database-migrations', 'medium');
  }
  if (/\b(?:postgres|mysql|mongo(?:db)?|redis|prisma|typeorm|jpa|hibernate|supabase|firebase)\b/.test(lower)) {
    add('database-engine', 'postgres-patterns', 'medium');
  }
  if (/\b(?:performance|slow|optimize|cache|caching|memory|cpu|lag|bundle|latency|profile|profiling)\b/.test(lower)) {
    add('performance', 'frontend-patterns', 'medium');
  }
  if (/\b(?:microservices?|grpc|kafka|rabbitmq|events?|message|queue)\b/.test(lower)) {
    add('integration', 'api-design', 'medium');
  }
  if (/\b(?:refactor|clean|debt|smell|extract|decouple)\b/.test(lower)) {
    add('refactoring', 'java-code-review', 'medium');
  }

  if (domains.length === 0) {
    add('general', 'frontend-patterns', 'medium');
  }

  // Complexity heuristic based on domain count + task indicators
  const domainCount = domains.length;
  const hasMultiplePlatforms = /\b(?:and|plus|with|integrate|between)\b|\+/.test(lower);
  const hasArchitecturalTerms = /\b(?:architecture|hexagonal|domain|event sourcing|microservices?)\b/.test(lower);
  const hasLargeScope = /\b(?:all|every|entire|full|whole|complete)\b/.test(lower);
  // Depth signals: even a single-domain task is non-trivial if it is a refactor, a
  // quality/best-practice sweep, a security/perf review, or a migration. Keep these off
  // the cheapest model tier.
  const hasDepthSignal = /\b(?:refactor|rewrite|modernize|code quality|best[ -]practices?|smells?|maintainability|tech(?:nical)? debt|security|vulnerability|migrate|migration|performance)\b/.test(lower);

  let complexity = 'Low';
  if (domainCount >= 4 || hasArchitecturalTerms || (hasMultiplePlatforms && domainCount >= 2)) {
    complexity = 'High';
  } else if (domainCount >= 2 || hasLargeScope || hasDepthSignal) {
    complexity = 'Medium';
  }

  const agentCount = Math.min(domains.filter(d => d.priority === 'high').length + 1, 6);

  return { domains, complexity, agentCount };
}

function getSkillInvocationPlan(task, template, domains, platforms = [], complexity, options) {
  const lower = task.toLowerCase();
  const plan = [];
  const add = (skill, reason, instruction) => {
    if (plan.some(item => item.skill === skill)) return;
    plan.push({ skill, reason, instruction, model: selectModel(task, complexity, options) });
  };

  add(
    'find-skills',
    'discover newer or more specialized skills beyond the local hardcoded list',
    'Run this before domain work. Search local installed skills first, then use the open skills ecosystem search when network/tooling is available. If a better skill exists, recommend installing/loading it and rerunning the task with that skill.'
  );

  for (const platform of platforms) {
    // Lead with the task-fit skill (e.g. springboot-patterns for a refactor), not the
    // positional first entry (api-design). Mark the rest demand-driven, not blanket
    // mandatory, so the prompt does not force security/DB passes on a task that touches
    // neither (respects minimal-scope).
    const primary = pickPrimarySkill(platform.defaultSkills, template);
    add(
      primary,
      `${platform.label} primary skill for this task`,
      `Load this first for ${platform.label}. Expected evidence: ${platform.evidence}.`
    );
    for (const skill of (platform.defaultSkills || []).filter(s => s !== primary)) {
      add(
        skill,
        `${platform.label} skill — conditional`,
        `Invoke only if the grounding step finds work it covers (persistence, security, contracts, migrations, etc.); otherwise mark it N/A with a one-line reason. Do not do work the task does not need.`
      );
    }
  }

  if (/\b(?:admin|dashboard|analytics|kpi|widgets?|mui|tables?|charts?)\b/.test(lower)) {
    add(
      'enterprise-ui-architect',
      'admin dashboard structure, component-library composition, enterprise density, tables/cards/charts',
      'Load this first. Use it to judge layout hierarchy, dashboard information architecture, component-system discipline, and enterprise admin polish using the project\'s existing UI kit.'
    );
  }

  if (/\b(?:design|ui|ux|style|layout|theme|visual|responsive|dashboard|pages?|screen)\b/.test(lower)) {
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

  if (/\b(?:react|reactjs|next|nextjs|tsx|frontend|components?|hooks?|context|dashboard|pages?|screen)\b/.test(lower)) {
    add(
      'frontend-patterns',
      'Next.js/component architecture, hooks, state, i18n, and client/server boundaries',
      'Use it to inspect the actual route, component tree, data hooks, API client, and locale files before making any judgment.'
    );
  }

  if (template === 'audit' || /\b(?:review|audit|check|confirm|verify|qa|working)\b|all working/.test(lower)) {
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

  if (/\b(?:security|auth|jwt|cors|xss|csrf|permissions?)\b/.test(lower)) {
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

function getSkillSearchQueries(task, domains, platforms = [], stack = '') {
  const lower = task.toLowerCase();
  const queries = new Set();
  const stackName = stack.replace(/-/g, ' ');

  // Stack-specific queries first
  if (stackName) {
    queries.add(`${stackName} best practices`);
    queries.add(`${stackName} security review`);
    queries.add(`${stackName} testing review`);
  }

  if (/\b(?:admin|dashboard|analytics|kpi|widgets?|tables?|charts?)\b/.test(lower)) {
    queries.add('enterprise admin dashboard ui review');
    queries.add('dashboard design system charts tables');
  }
  if (/\b(?:design|ui|ux|visual|layout|responsive|pages?|screen)\b/.test(lower)) {
    queries.add('ui ux design review');
    queries.add('frontend visual design polish');
  }
  if (/\b(?:react|reactjs|next|nextjs|tsx|frontend)\b/.test(lower)) {
    queries.add('nextjs react frontend best practices');
  }
  if (/\b(?:tests?|qa|verify|confirm|working|browser)\b/.test(lower)) {
    queries.add('browser qa playwright verification');
  }
  if (/\b(?:security|auth|permissions?|jwt|xss|csrf)\b/.test(lower)) {
    queries.add('security review auth frontend');
  }

  for (const platform of platforms) {
    queries.add(`${platform.label} expert skill`);
    queries.add(`${platform.label} testing review best practices`);
  }

  for (const domain of domains) {
    queries.add(domain.domain.replace(/-/g, ' '));
  }

  if (queries.size === 0) queries.add(sanitizeShellArg(task) || 'software project best practices');
  return [...queries].slice(0, 5);
}

function getSkillDiscoveryProtocol(task, domains, platforms = [], stack = '', stackProfile = null) {
  const queries = getSkillSearchQueries(task, domains, platforms, stack);

  if (stackProfile && stackProfile.status === 'hit') {
    return [
      `Stack profile cache: HIT at ${stackProfile.relativePath}.`,
      'Read the cached stack profile first and use its required skills, missing-skill queue, best practices, anti-patterns, and verification gates.',
      'Do not repeat broad local skill scans or ecosystem searches for this stack on this run.',
      'Only refresh discovery if the cached profile is stale, the task introduces a new platform, or the user explicitly asks for refresh.',
      'If a cached required skill is missing, ask the user before installing it; never install skills silently.',
    ];
  }

  if (stackProfile && (stackProfile.status === 'created' || stackProfile.status === 'refreshed')) {
    const status = stackProfile.status === 'created' ? 'MISS -> CREATED' : 'REFRESHED';
    return [
      `Stack profile cache: ${status} at ${stackProfile.relativePath}.`,
      'Prompt Builder generated the stack profile before this prompt using bundled stack intelligence and installed skill metadata.',
      'Use the generated profile as the source of truth for required skills, missing-skill queue, best practices, anti-patterns, and verification gates.',
      'Do not run ecosystem searches again during this prompt unless the generated profile explicitly says a stronger skill is needed.',
      'If a generated missing-skill entry is required, ask the user for approval before running any install command.',
    ];
  }

  return [
    'Purpose: do not rely only on the prompt-builder hardcoded skill list. Discover whether a newer, more specialized skill exists before doing the work.',
    'Step 1 — Local scan: inspect available skill metadata in .claude/skills, .codex/skills, .agents/skills, and globally installed skill folders. Match by name and description, not by filename only.',
    'Step 2 — Ecosystem scan: invoke the find-skills workflow. If CLI/network is available, run npx skills find with the queries below.',
    ...queries.map(query => `Search query: npx skills find "${query}"`),
    'Step 2b — Trusted sources only: if the skill is not installed locally, research it on the internet ONLY from trusted sources — the npm registry (scoped skill packages via npx skills), GitHub (repos/topics with a clear SKILL.md, meaningful stars, and recent commits), and curated ecosystem signals on x.com from reputable authors. Never install from anonymous gists, pastebins, shortened URLs, or unvetted low-signal sources.',
    'Step 3 — Quality gate: confirm the source is one of the trusted sources above, then judge install count, clear SKILL.md instructions, maintenance recency, and direct task fit. Do not recommend a random low-signal skill just because it appears in search.',
    'Step 4 — Recommendation: if a better skill is found, stop and recommend: install command, why it is better, and the exact prompt command to rerun after /reload-skills.',
    'Step 5 — Fallback: if no better skill is found or install is not approved, continue with the best installed skills listed below and explicitly say discovery found no stronger option.',
  ];
}

function getAgentCouncil(task, mode, complexity, options, surface = {}) {
  const { isUi = true, isService = false } = surface;
  const lower = task.toLowerCase();
  const agents = [];
  const add = (name, mission, output) => agents.push({ name, mission, output, model: selectModel(task, complexity, options) });

  if (/\b(?:design|ui|ux|dashboard|pages?|screen|visual|layout)\b/.test(lower)) {
    add(
      'Lead Product Designer',
      'Judge whether the screen feels professional, coherent, and useful at first glance.',
      'Visual hierarchy, spacing rhythm, typography, density, contrast, empty/loading/error state quality, and top 5 design fixes.'
    );
    add(
      'Enterprise UI Architect',
      'Check admin/dashboard composition against established enterprise UI patterns.',
      'Layout map, widget priority, card/table/chart quality, token usage, and component-system violations.'
    );
  }

  if (isService && !isUi) {
    add(
      'Backend/Service Code Reviewer',
      'Trace actual files, services, repositories, transaction boundaries, error/exception handling, and public contracts.',
      'File:line findings, broken assumptions, invariant/concurrency/transaction risks, risky code paths, and scoped fix plan.'
    );
  } else {
    add(
      'Frontend Code Reviewer',
      'Trace actual files, hooks, API calls, i18n keys, and state boundaries.',
      'File:line findings, broken assumptions, missing states, risky code paths, and scoped fix plan.'
    );
  }

  if (mode === 'audit' || /\b(?:review|audit|verify|confirm|working|qa)\b/.test(lower)) {
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

  if (mode === 'security-review' || /\b(?:security|auth|jwt|xss|csrf)\b/.test(lower)) {
    add(
      'Security Auditor',
      'Review auth, authorization, secrets, XSS/CSRF, and data exposure.',
      'Risk findings with CWE reference, reproduction steps, and fix priority.'
    );
  }

  if (mode === 'performance-review' || /\b(?:performance|slow|optimize|lag)\b/.test(lower)) {
    add(
      'Performance Engineer',
      'Profile hot paths and measure before/after.',
      'Baseline metrics, profiler evidence, optimization recommendation, post-fix measurements.'
    );
  }

  if (mode === 'architecture-review' || /\b(?:architecture|hexagonal|clean|domain)\b/.test(lower)) {
    add(
      'System Architect',
      'Map boundaries, coupling, cohesion, and dependency direction.',
      'Architecture map, coupling issues, dependency violations, restructure recommendation.'
    );
  }

  if (/\b(?:backend|api|server|controller|service|repository|endpoint)\b/.test(lower)) {
    add(
      'Backend/API Architect',
      'Review endpoint design, service boundaries, data flow, and contract consistency.',
      'API map, endpoint contracts, service layer findings, database query issues, and refactoring plan.'
    );
  }

  if (/\b(?:database|db|migrations?|schema|sql|postgres|mongo(?:db)?|redis|prisma|typeorm|jpa)\b/.test(lower)) {
    add(
      'Database/Migration Agent',
      'Review schema design, query performance, indexing, and migration safety.',
      'ER map, slow query analysis, index recommendations, migration risk assessment.'
    );
  }

  if (/\b(?:microservices?|grpc|kafka|rabbitmq|events?|integration|webhook)\b/.test(lower)) {
    add(
      'Integration/Test Agent',
      'Review cross-service contracts, event flow, idempotency, and test coverage.',
      'Integration map, contract compatibility, event flow diagram, test gap analysis.'
    );
  }

  if (/\b(?:devops|deploy|ci|cd|pipeline|docker|kubernetes|infra)\b/.test(lower)) {
    add(
      'DevOps/Release Agent',
      'Review deployment pipeline, env config, rollback, and observability.',
      'Pipeline map, env risk, rollback plan, monitoring gaps, release checklist.'
    );
  }

  return agents;
}

function getUniversalAgentRoster(task, mode, platforms = [], complexity, options) {
  const agents = [];
  // Each agent is bound to the skill it must load/invoke to do its job. Platform
  // agents inherit the platform's primary skill (currentSkill); cross-cutting
  // agents pass an explicit skill.
  let currentSkill = 'find-skills';
  const add = (role, owns, when, deliverable, skill) => {
    if (agents.some(agent => agent.role === role)) return;
    agents.push({ role, owns, when, deliverable, skill: skill || currentSkill, model: selectModel(task, complexity, options) });
  };

  add(
    'Coordinator / Tech Lead',
    'task decomposition, dependency graph, conflict boundaries, final synthesis',
    'always',
    'task board, agent assignment table, merged decision log, final verdict',
    'none (orchestration)'
  );
  add(
    'Skill Scout',
    'local and ecosystem skill discovery before execution',
    'always',
    'skills searched, install/load recommendations, rerun command',
    'find-skills'
  );

  for (const platform of platforms) {
    currentSkill = pickPrimarySkill(platform.defaultSkills, mode);
    if (platform.id === 'web') {
      add('Frontend/Web Agent', 'routes, components, UI state, browser behavior', 'web/frontend tasks', 'file findings, UI fixes, browser evidence');
      add('Product/UI Designer Agent', 'visual hierarchy, layout, typography, responsive polish', 'visual/product tasks', 'designer rubric findings and top design fixes', 'ui-ux-pro-max');
    }
    if (platform.id === 'backend') {
      add('Backend/API Agent', 'controllers/services/repositories/contracts', 'backend/API tasks', 'endpoint flow, tests, contract risks');
      add('Data/DB Agent', 'schema, migrations, query correctness, persistence', 'database tasks', 'schema impact and data safety report', 'database-migrations');
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
    if (platform.id === 'node-express') {
      add('Node/Express Agent', 'routes, middleware, services, Express patterns', 'Node.js tasks', 'Express findings and test evidence');
    }
    if (platform.id === 'nestjs') {
      add('NestJS Agent', 'modules, controllers, services, decorators, DI', 'NestJS tasks', 'NestJS structure findings and test evidence');
    }
    if (platform.id === 'python-fastapi') {
      add('FastAPI Agent', 'async handlers, Pydantic, Alembic, pytest', 'FastAPI tasks', 'FastAPI findings and test evidence');
    }
    if (platform.id === 'python-django') {
      add('Django Agent', 'MVT, DRF, migrations, admin, pytest-django', 'Django tasks', 'Django findings and test evidence');
    }
    if (platform.id === 'ruby-rails') {
      add('Rails Agent', 'MVC, Active Record, RSpec, migrations, Sidekiq', 'Rails tasks', 'Rails findings and test evidence');
    }
  }

  add(
    'QA/Verification Agent',
    'static gates, runtime proof, regression checks, screenshots/logs',
    mode === 'audit' ? 'audit/review tasks' : 'after implementation',
    'commands run, pass/fail gates, blockers, residual risk',
    'verification-loop'
  );

  return agents;
}

function getMulticaStyleTaskBoard(task, mode, platforms = [], surface = {}) {
  const taskType = ['audit', 'bugfix', 'refactor'].includes(mode)
    ? mode
    : (mode.endsWith('-review') || mode === 'release-check' ? 'review' : 'implementation');

  const cards = [
    {
      id: 'T0',
      owner: 'Coordinator / Tech Lead',
      skill: 'none (orchestration)',
      title: 'Normalize request and define task graph',
      status: 'todo',
      dependsOn: 'none',
      artifact: 'task understanding, scope, platform map, stop conditions',
    },
    {
      id: 'T1',
      owner: 'Skill Scout',
      skill: 'find-skills',
      title: 'Discover local and ecosystem skills',
      status: 'todo',
      dependsOn: 'T0',
      artifact: 'skill search report and install/load recommendations',
    },
  ];

  platforms.forEach((platform, index) => {
    const platformSkill = pickPrimarySkill(platform.defaultSkills, mode);
    if (platform.isIntegrationLane) {
      cards.push({
        id: `I1`,
        owner: `${platform.label} Agent`,
        skill: platformSkill,
        title: `Cross-platform integration verification`,
        status: 'todo',
        dependsOn: platforms.filter(p => !p.isIntegrationLane).map((_, i) => `P${i + 1}`).join(', '),
        artifact: platform.evidence,
      });
    } else {
      cards.push({
        id: `P${index + 1}`,
        owner: `${platform.label} Agent`,
        skill: platformSkill,
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
      skill: 'verification-loop',
      title: 'Run verification gates and collect runtime evidence',
      status: 'todo',
      dependsOn: platforms.length ? platforms.filter(p => !p.isIntegrationLane).map((_, index) => `P${index + 1}`).join(', ') : 'T1',
      artifact: surface.isUi
        ? 'commands run + results, test output, logs/traces, plus screenshots + console/network for the UI surface'
        : 'commands run + results, test output, logs/traces, query output',
    },
    {
      id: 'S1',
      owner: 'Coordinator / Tech Lead',
      skill: 'none (synthesis)',
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
  if (!/\b(?:design|ui|ux|dashboard|pages?|screen|visual|layout|admin|components?|cards?)\b/.test(lower)) return [];

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
