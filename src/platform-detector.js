/**
 * Platform Detector
 * Detects software platforms from task text. Supports single-platform,
 * mixed-platform (multi-lane), and stack detection.
 */

const PLATFORM_REGISTRY = [
  {
    id: 'web',
    label: 'Web / Frontend',
    keywords: /web|frontend|react|next|tsx|jsx|dashboard|page|component|card|mui|vue|svelte|angular|shadcn|tailwind|css|html|dom/,
    defaultSkills: ['frontend-patterns', 'ui-ux-pro-max', 'browser-qa', 'verification-loop'],
    evidence: 'route/component tree, browser screenshots, console/network, typecheck/lint/build',
  },
  {
    id: 'backend',
    label: 'Backend / API',
    keywords: /backend|api|server|spring|java|node|express|nestjs|fastapi|django|flask|controller|service|repository|database|postgres|sql|graphql|rest/,
    defaultSkills: ['api-design', 'springboot-patterns', 'postgres-patterns', 'database-migrations', 'security-review', 'verification-loop'],
    evidence: 'endpoint contracts, service flow, database/schema impact, unit/integration tests, security checks',
  },
  {
    id: 'ios',
    label: 'iOS / Swift',
    keywords: /ios|swift|swiftui|uikit|xcode|iphone|ipad|visionos|watchos|macos|cocoa/,
    defaultSkills: ['build-ios-apps:swiftui-ui-patterns', 'build-ios-apps:ios-debugger-agent', 'build-ios-apps:swiftui-performance-audit'],
    evidence: 'Xcode project/scheme, SwiftUI hierarchy, simulator run, screenshots, logs, XCTest where available',
  },
  {
    id: 'android',
    label: 'Android / Kotlin',
    keywords: /android|kotlin|jetpack|compose|gradle|apk|emulator|xml|mvvm/,
    defaultSkills: ['test-android-apps:android-emulator-qa', 'test-android-apps:android-performance', 'find-skills'],
    evidence: 'Gradle tasks, emulator QA, screenshots, logcat, UI state checks, instrumentation/unit tests',
  },
  {
    id: 'flutter',
    label: 'Flutter / Dart',
    keywords: /flutter|dart/,
    defaultSkills: ['find-skills'],
    evidence: 'widget tree, flutter analyze/test, device/emulator screenshots, platform-specific constraints',
  },
  {
    id: 'react-native',
    label: 'React Native / Expo',
    keywords: /react native|react-native|expo/,
    defaultSkills: ['find-skills', 'ui-ux-pro-max'],
    evidence: 'Metro/Expo flow, native platform checks, screenshots, accessibility, state/data hooks',
  },
  {
    id: 'desktop',
    label: 'Desktop App',
    keywords: /desktop|electron|tauri|native app/,
    defaultSkills: ['find-skills', 'verification-loop'],
    evidence: 'window states, OS integration, packaging constraints, runtime logs, interaction QA',
  },
  {
    id: 'cli',
    label: 'CLI / Tooling',
    keywords: /cli|command line|terminal|script|tooling/,
    defaultSkills: ['find-skills', 'verification-loop'],
    evidence: 'command UX, flags/help text, exit codes, fixtures, shell tests',
  },
  {
    id: 'devops',
    label: 'DevOps / Deployment',
    keywords: /docker|deploy|vercel|ci|cd|pipeline|kubernetes|infra|devops|helm|terraform/,
    defaultSkills: ['docker-patterns', 'deploy-to-vercel', 'verification-loop'],
    evidence: 'environment assumptions, build/deploy commands, rollback, logs, CI evidence',
  },
  {
    id: 'ai',
    label: 'AI / Agent / RAG App',
    keywords: /ai|llm|rag|agent|openai|model|embedding|vector|langchain|crewai/,
    defaultSkills: ['openai-docs', 'find-skills'],
    evidence: 'model/API docs, prompt/data flow, eval cases, persistence, safety and cost checks',
  },
  {
    id: 'laravel',
    label: 'Laravel / PHP',
    keywords: /laravel|php|eloquent|blade|artisan|composer|symfony/,
    defaultSkills: ['find-skills'],
    evidence: 'route/controller structure, Eloquent models, Blade views, artisan commands, PHPUnit tests',
  },
  {
    id: 'python',
    label: 'Python',
    keywords: /python|fastapi|django|flask|pydantic|sqlalchemy|celery/,
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
    keywords: /rust|cargo|actix|tokio|axum|tide|rocket/,
    defaultSkills: ['find-skills'],
    evidence: 'crate structure, async runtime, cargo test/clippy, memory-safety evidence',
  },
  {
    id: 'dotnet',
    label: '.NET / C#',
    keywords: /\.net|c#|asp\.net|ef core|blazor|xamarin|dotnet/,
    defaultSkills: ['find-skills'],
    evidence: 'solution/project structure, controller/services, EF migrations, xUnit tests',
  },
  {
    id: 'unity',
    label: 'Unity / Game Dev',
    keywords: /unity|game dev|unreal|godot|csharp game|physics|shader/,
    defaultSkills: ['find-skills'],
    evidence: 'scene hierarchy, script architecture, build targets, play-mode tests, profiler evidence',
  },
  {
    id: 'data-ml',
    label: 'Data / ML Pipeline',
    keywords: /data pipeline|ml|pytorch|tensorflow|pandas|jupyter|sklearn|notebook/,
    defaultSkills: ['find-skills'],
    evidence: 'data flow, model versioning, eval metrics, pipeline reproducibility, notebook review',
  },
  {
    id: 'db',
    label: 'Database',
    keywords: /postgresql|mongo|redis|elasticsearch|prisma|drizzle|clickhouse|sqlite/,
    defaultSkills: ['database-migrations', 'postgres-patterns'],
    evidence: 'schema design, migration safety, query plan, indexing, backup/restore evidence',
  },
];

function detectPlatforms(task) {
  const lower = task.toLowerCase();
  const platforms = [];

  for (const p of PLATFORM_REGISTRY) {
    if (p.keywords.test(lower)) {
      platforms.push({
        id: p.id,
        label: p.label,
        signals: p.keywords.source,
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
  if (/\blaravel\b|\bphp\b/.test(lower)) return 'laravel';
  if (/\bpython\b|\bfastapi\b|\bdjango\b|\bflask\b/.test(lower)) return 'python';
  if (/\bgolang\b|\bgo\b\s+module|\bgin\b|\becho\b|\bfiber\b/.test(lower)) return 'go';
  if (/\brust\b|\bcargo\b|\bactix\b|\btokio\b|\baxum\b/.test(lower)) return 'rust';
  if (/\.net|\bc#\b|\basp\.net\b|\bef\s+core\b|\bblazor\b/.test(lower)) return 'dotnet';
  if (/\bunity\b|\bgame\s+dev\b|\bunreal\b|\bgodot\b/.test(lower)) return 'unity';
  if (/\bdata\s+pipeline\b|\bml\b|\bpytorch\b|\btensorflow\b|\bpandas\b/.test(lower)) return 'data-ml';
  if (/\bpostgresql\b|\bmongo\b|\bredis\b|\belasticsearch\b|\bprisma\b|\bdrizzle\b/.test(lower)) return 'db';
  if (/\bios\b|\bswift\b|\bswiftui\b|\bxcode\b|\biphone\b|\bipad\b|\bvisionos\b|\bwatchos\b|\bmacos\b/.test(lower)) return 'ios-swift';
  if (/\bandroid\b|\bkotlin\b|\bjetpack\b|\bcompose\b|\bapk\b|\bemulator\b/.test(lower)) return 'android-kotlin';
  if (/\bflutter\b|\bdart\b/.test(lower)) return 'flutter';
  if (/\breact\s+native\b|\bexpo\b/.test(lower)) return 'react-native';
  if (/\bcli\b|\bcommand\s+line\b|\bterminal\b|\bscript\b|\btooling\b/.test(lower)) return 'cli';
  if (/\bdesktop\b|\belectron\b|\btauri\b|\bnative\s+app\b/.test(lower)) return 'desktop';
  if (/\bai\b|\bllm\b|\brag\b|\bagent\b|\bopenai\b|\bmodel\b|\bembedding\b|\bvector\b/.test(lower)) return 'ai-app';
  if (/\bdocker\b|\bdeploy\b|\bvercel\b|\bci\/cd\b|\bpipeline\b|\bkubernetes\b|\binfra\b|\bdevops\b/.test(lower)) return 'devops';
  if (/\bspring\b|\bjava\b|\bgradle\b|\bbackend\b/.test(lower)) return 'spring-boot';
  if (/\breact\b|\bnext\b|\btsx\b|\bfrontend\b|\bshadcn\b|\bmui\b|\bdashboard\b|\badmin\b|\bpage\b|\bcomponent\b|\bcard\b/.test(lower)) return 'nextjs';
  return 'general';
}

module.exports = { detectPlatforms, detectPlatformsMixed, detectStack, PLATFORM_REGISTRY };
