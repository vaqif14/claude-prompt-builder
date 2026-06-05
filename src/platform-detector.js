/**
 * Platform Detector
 * Detects software platforms from task text. Supports single-platform,
 * mixed-platform (multi-lane), and stack detection.
 */

const PLATFORM_REGISTRY = [
  {
    id: 'web',
    label: 'Web / Frontend',
    keywords: /\b(?:web|frontend|react(?:js)?|next(?:js)?|tsx|jsx|dashboards?|pages?|components?|cards?|mui|vue(?:js)?|svelte|angular|shadcn|tailwind|css|html|dom)\b/,
    defaultSkills: ['frontend-patterns', 'ui-ux-pro-max', 'browser-qa', 'verification-loop'],
    evidence: 'route/component tree, browser screenshots, console/network, typecheck/lint/build',
  },
  {
    id: 'backend',
    label: 'Backend / API',
    keywords: /\b(?:backend|api|server|spring|java|controller|service|repository|database|sql|graphql|rest)\b/,
    defaultSkills: ['api-design', 'springboot-patterns', 'postgres-patterns', 'database-migrations', 'security-review', 'verification-loop'],
    evidence: 'endpoint contracts, service flow, database/schema impact, unit/integration tests, security checks',
  },
  {
    id: 'node-express',
    label: 'Node.js / Express',
    keywords: /\bexpress\b|\bnode\b|\bnodejs\b/,
    defaultSkills: ['find-skills'],
    evidence: 'route handlers, middleware chain, Jest/Supertest, PM2/Docker runtime',
  },
  {
    id: 'nestjs',
    label: 'NestJS',
    keywords: /\bnestjs\b/,
    defaultSkills: ['find-skills'],
    evidence: 'module structure, decorators, DI container, Jest testing, Swagger docs',
  },
  {
    id: 'python-fastapi',
    label: 'Python / FastAPI',
    keywords: /\bfastapi\b/,
    defaultSkills: ['find-skills'],
    evidence: 'async handlers, Pydantic models, Alembic migrations, pytest, OpenAPI docs',
  },
  {
    id: 'python-django',
    label: 'Python / Django',
    keywords: /\bdjango\b/,
    defaultSkills: ['find-skills'],
    evidence: 'MVT structure, DRF serializers, migrations, pytest-django, admin panel',
  },
  {
    id: 'ruby-rails',
    label: 'Ruby / Rails',
    keywords: /\brails\b|\bruby\b/,
    defaultSkills: ['find-skills'],
    evidence: 'MVC structure, Active Record, RSpec, migrations, Rails logs',
  },
  {
    id: 'ios',
    label: 'iOS / Swift',
    keywords: /\b(?:ios|swift|swiftui|uikit|xcode|iphone|ipad|visionos|watchos|macos|cocoa)\b/,
    defaultSkills: ['build-ios-apps:swiftui-ui-patterns', 'build-ios-apps:ios-debugger-agent', 'build-ios-apps:swiftui-performance-audit'],
    evidence: 'Xcode project/scheme, SwiftUI hierarchy, simulator run, screenshots, logs, XCTest where available',
  },
  {
    id: 'android',
    label: 'Android / Kotlin',
    keywords: /\b(?:android|kotlin|jetpack|compose|gradle|apk|emulator|xml|mvvm)\b/,
    defaultSkills: ['test-android-apps:android-emulator-qa', 'test-android-apps:android-performance', 'find-skills'],
    evidence: 'Gradle tasks, emulator QA, screenshots, logcat, UI state checks, instrumentation/unit tests',
  },
  {
    id: 'flutter',
    label: 'Flutter / Dart',
    keywords: /\b(?:flutter|dart)\b/,
    defaultSkills: ['find-skills'],
    evidence: 'widget tree, flutter analyze/test, device/emulator screenshots, platform-specific constraints',
  },
  {
    id: 'react-native',
    label: 'React Native / Expo',
    keywords: /react native|react-native|\bexpo\b/,
    defaultSkills: ['find-skills', 'ui-ux-pro-max'],
    evidence: 'Metro/Expo flow, native platform checks, screenshots, accessibility, state/data hooks',
  },
  {
    id: 'desktop',
    label: 'Desktop App',
    keywords: /\b(?:desktop|electron|tauri)\b|native app/,
    defaultSkills: ['find-skills', 'verification-loop'],
    evidence: 'window states, OS integration, packaging constraints, runtime logs, interaction QA',
  },
  {
    id: 'cli',
    label: 'CLI / Tooling',
    keywords: /\b(?:cli|terminal|script|tooling)\b|command line/,
    defaultSkills: ['find-skills', 'verification-loop'],
    evidence: 'command UX, flags/help text, exit codes, fixtures, shell tests',
  },
  {
    id: 'devops',
    label: 'DevOps / Deployment',
    keywords: /\b(?:docker|deploy|vercel|ci|cd|pipeline|kubernetes|infra|devops|helm|terraform)\b/,
    defaultSkills: ['docker-patterns', 'deploy-to-vercel', 'verification-loop'],
    evidence: 'environment assumptions, build/deploy commands, rollback, logs, CI evidence',
  },
  {
    id: 'ai',
    label: 'AI / Agent / RAG App',
    keywords: /\b(?:ai|llm|rag|agent|openai|model|embedding|vector|langchain|crewai)\b/,
    defaultSkills: ['openai-docs', 'find-skills'],
    evidence: 'model/API docs, prompt/data flow, eval cases, persistence, safety and cost checks',
  },
  {
    id: 'laravel',
    label: 'Laravel / PHP',
    keywords: /\b(?:laravel|php|eloquent|blade|artisan|composer|symfony)\b/,
    defaultSkills: ['find-skills'],
    evidence: 'route/controller structure, Eloquent models, Blade views, artisan commands, PHPUnit tests',
  },
  {
    id: 'python',
    label: 'Python',
    keywords: /\b(?:python|fastapi|django|flask|pydantic|sqlalchemy|celery)\b/,
    defaultSkills: ['find-skills'],
    evidence: 'app structure, route handlers, ORM models, pytest coverage, type hints (mypy)',
  },
  {
    id: 'go',
    label: 'Go',
    keywords: /\bgolang\b|\bgo\b\s+module|\bgin\b|\becho\b|\bfiber\b|\bmux\b|\bgrpc\b/,
    defaultSkills: ['find-skills'],
    evidence: 'module structure, handler layers, DB/storage, go test, benchmark evidence',
  },
  {
    id: 'rust',
    label: 'Rust',
    keywords: /\b(?:rust|cargo|actix|tokio|axum|tide|rocket)\b/,
    defaultSkills: ['find-skills'],
    evidence: 'crate structure, async runtime, cargo test/clippy, memory-safety evidence',
  },
  {
    id: 'dotnet',
    label: '.NET / C#',
    keywords: /\.net|c#|asp\.net|\bef core\b|\bblazor\b|\bxamarin\b|\bdotnet\b/,
    defaultSkills: ['find-skills'],
    evidence: 'solution/project structure, controller/services, EF migrations, xUnit tests',
  },
  {
    id: 'unity',
    label: 'Unity / Game Dev',
    keywords: /\b(?:unity|unreal|godot|shader)\b|game dev|csharp game|\bphysics\b/,
    defaultSkills: ['find-skills'],
    evidence: 'scene hierarchy, script architecture, build targets, play-mode tests, profiler evidence',
  },
  {
    id: 'data-ml',
    label: 'Data / ML Pipeline',
    keywords: /data pipeline|\bml\b|\bpytorch\b|\btensorflow\b|\bpandas\b|\bjupyter\b|\bsklearn\b|\bnotebook\b/,
    defaultSkills: ['find-skills'],
    evidence: 'data flow, model versioning, eval metrics, pipeline reproducibility, notebook review',
  },
  {
    id: 'db',
    label: 'Database',
    keywords: /\b(?:postgresql|mongo(?:db)?|redis|elasticsearch|prisma|drizzle|clickhouse|sqlite)\b/,
    defaultSkills: ['database-migrations', 'postgres-patterns'],
    evidence: 'schema design, migration safety, query plan, indexing, backup/restore evidence',
  },
];

// Turn a keyword regex into a short human-readable signal list for the prompt,
// instead of leaking the raw regex source (\b(?:...)\b) to the next agent.
function humanizeSignals(regex) {
  return regex.source
    .replace(/\\b/g, '')
    .replace(/\(\?:/g, '')
    .replace(/[()?]/g, '')
    .replace(/\\s\+/g, ' ')
    .replace(/\\/g, '')
    .split('|')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(', ');
}

function detectPlatforms(task) {
  const lower = task.toLowerCase();
  const platforms = [];

  for (const p of PLATFORM_REGISTRY) {
    if (p.keywords.test(lower)) {
      platforms.push({
        id: p.id,
        label: p.label,
        signals: humanizeSignals(p.keywords),
        defaultSkills: [...p.defaultSkills],
        evidence: p.evidence,
      });
    }
  }

  if (platforms.length === 0) {
    platforms.push({
      id: 'general',
      label: 'General Software Task',
      signals: 'no explicit platform detected',
      defaultSkills: ['find-skills', 'verification-loop'],
      evidence: 'source inspection, task-specific tests, runtime proof when applicable',
    });
  }

  return platforms;
}

function detectPlatformsMixed(task) {
  const platforms = detectPlatforms(task);

  // Mixed-platform: if multiple non-general platforms detected, create lanes
  const nonGeneral = platforms.filter(p => p.id !== 'general');
  if (nonGeneral.length > 1) {
    // Add an integration lane
    platforms.push({
      id: 'integration',
      label: 'Integration / Cross-Platform',
      signals: 'multiple platforms detected',
      defaultSkills: ['find-skills', 'verification-loop'],
      evidence: 'cross-platform contract verification, end-to-end flow, shared data model',
      isIntegrationLane: true,
    });
  }

  return platforms;
}

function detectStack(task) {
  const lower = task.toLowerCase();
  // Specific stacks first — use word boundaries for short tokens to avoid false positives

  // Database stacks (detect before generic backend)
  if (/\bsupabase\b/.test(lower)) return 'supabase';
  if (/\bfirebase\b/.test(lower)) return 'firebase';
  if (/\bprisma\b/.test(lower)) return 'prisma';
  if (/\btypeorm\b/.test(lower)) return 'typeorm';
  if (/\bjpa\b|\bhibernate\b/.test(lower)) return 'jpa-hibernate';
  if (/\bpostgresql\b|\bpostgres\b/.test(lower)) return 'postgres';
  if (/\bmysql\b/.test(lower)) return 'mysql';
  if (/\bmongodb\b|\bmongo\b/.test(lower)) return 'mongodb';
  if (/\bredis\b/.test(lower)) return 'redis';

  // Python stacks
  if (/\bfastapi\b/.test(lower)) return 'python-fastapi';
  if (/\bdjango\b/.test(lower)) return 'python-django';
  if (/\bflask\b/.test(lower)) return 'python';
  if (/\bpython\b/.test(lower)) return 'python';

  // Node.js stacks
  if (/\bnestjs\b/.test(lower)) return 'nestjs';
  if (/\bexpress\b/.test(lower)) return 'node-express';
  if (/\bnode\b|\bnodejs\b/.test(lower)) return 'node-express';

  // Other backend stacks
  if (/\blaravel\b/.test(lower)) return 'laravel';
  if (/\bphp\b/.test(lower)) return 'laravel';
  if (/\brails\b/.test(lower)) return 'ruby-rails';
  if (/\bruby\b/.test(lower)) return 'ruby-rails';
  if (/\bspring\b|\bjava\b|\bgradle\b/.test(lower)) return 'spring-boot';
  if (/\bgolang\b|\bgo\b\s+module|\bgin\b|\becho\b|\bfiber\b/.test(lower)) return 'go';
  if (/\brust\b|\bcargo\b|\bactix\b|\btokio\b|\baxum\b/.test(lower)) return 'rust';
  if (/\.net|\bc#\b|\basp\.net\b|\bef\s+core\b|\bblazor\b/.test(lower)) return 'dotnet';

  // Other stacks
  if (/\bunity\b|\bgame\s+dev\b|\bunreal\b|\bgodot\b/.test(lower)) return 'unity';
  if (/\bdata\s+pipeline\b|\bml\b|\bpytorch\b|\btensorflow\b|\bpandas\b/.test(lower)) return 'data-ml';
  if (/\bios\b|\bswift\b|\bswiftui\b|\bxcode\b|\biphone\b|\bipad\b|\bvisionos\b|\bwatchos\b|\bmacos\b/.test(lower)) return 'ios-swift';
  if (/\bandroid\b|\bkotlin\b|\bjetpack\b|\bcompose\b|\bapk\b|\bemulator\b/.test(lower)) return 'android-kotlin';
  if (/\bflutter\b|\bdart\b/.test(lower)) return 'flutter';
  if (/\breact\s+native\b|\bexpo\b/.test(lower)) return 'react-native';
  if (/\bcli\b|\bcommand\s+line\b|\bterminal\b|\bscript\b|\btooling\b/.test(lower)) return 'cli';
  if (/\bdesktop\b|\belectron\b|\btauri\b|\bnative\s+app\b/.test(lower)) return 'desktop';
  if (/\bai\b|\bllm\b|\brag\b|\bagent\b|\bopenai\b|\bmodel\b|\bembedding\b|\bvector\b/.test(lower)) return 'ai-app';
  if (/\bdocker\b|\bdeploy\b|\bvercel\b|\bci\/cd\b|\bpipeline\b|\bkubernetes\b|\binfra\b|\bdevops\b/.test(lower)) return 'devops';
  if (/\breactjs?\b|\bnextjs?\b|\btsx\b|\bfrontend\b|\bshadcn\b|\bmui\b|\bdashboard\b|\badmin\b|\bpages?\b|\bcomponents?\b|\bcards?\b/.test(lower)) return 'nextjs';
  if (/\bbackend\b|\bapi\b|\bserver\b/.test(lower)) return 'spring-boot';
  return 'general';
}

module.exports = { detectPlatforms, detectPlatformsMixed, detectStack, PLATFORM_REGISTRY };
