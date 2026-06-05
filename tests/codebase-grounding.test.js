const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  groundInRepo, detectBuildAndTest, detectStackFromDeps, findTargets, extractInvariants, tokenize,
  surfaceFromTargets, classifySurface, pickStackName,
} = require('../src/codebase-grounding');

function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (e) { console.log(`  ❌ ${name}`); console.log(`     ${e.message}`); process.exitCode = 1; }
}

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-ground-'));
  return d;
}
function write(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

console.log('\nCodebase Grounding Tests');

test('detectBuildAndTest: Gradle wrapper repo', () => {
  const d = tmp();
  write(d, 'build.gradle.kts', 'plugins {}');
  write(d, 'gradlew', '#!/bin/sh');
  const b = detectBuildAndTest(d);
  assert.strictEqual(b.tool, 'Gradle');
  assert.strictEqual(b.test, './gradlew test');
});

test('detectBuildAndTest: pnpm JS repo reads scripts', () => {
  const d = tmp();
  write(d, 'package.json', JSON.stringify({ scripts: { test: 'vitest', lint: 'eslint .' } }));
  write(d, 'pnpm-lock.yaml', 'lockfileVersion: 6');
  const b = detectBuildAndTest(d);
  assert.strictEqual(b.tool, 'pnpm');
  assert.strictEqual(b.test, 'pnpm test');
  assert.strictEqual(b.lint, 'pnpm lint');
});

test('detectStackFromDeps: reads real libs from package.json', () => {
  const d = tmp();
  write(d, 'package.json', JSON.stringify({ dependencies: { next: '16.0.0', '@mui/material': '7.0.0', '@tanstack/react-query': '5.0.0', zustand: '4' } }));
  const s = detectStackFromDeps(d);
  assert(s.some(x => /Next\.js/.test(x)), `expected Next.js: ${s}`);
  assert(s.some(x => /MUI/.test(x)));
  assert(s.includes('TanStack Query'));
  assert(s.includes('Zustand'));
});

test('detectStackFromDeps: reads Spring Boot + LDAP from gradle', () => {
  const d = tmp();
  write(d, 'build.gradle.kts', 'dependencies { implementation("org.springframework.boot:spring-boot-starter-web"); implementation("org.springframework.boot:spring-boot-starter-ldap"); implementation("org.flywaydb:flyway-core") }');
  const s = detectStackFromDeps(d);
  assert(s.includes('Spring Boot'));
  assert(s.includes('LDAP'));
  assert(s.includes('Flyway'));
});

test('findTargets: matches files by task tokens', () => {
  const d = tmp();
  write(d, 'src/features/bidder/ProductList.tsx', 'export const X = 1');
  write(d, 'src/features/admin/Dashboard.tsx', 'export const Y = 1');
  const t = findTargets(d, 'review bidder product list', 5);
  assert(t.some(x => /ProductList\.tsx/.test(x)), `expected ProductList match: ${t}`);
});

test('findTargets: flags a redirect stub', () => {
  const d = tmp();
  write(d, 'src/app/products/page.tsx', 'export default function P(){ redirect("/auctions") }');
  const t = findTargets(d, 'products page', 5);
  assert(t.some(x => /products\/page\.tsx.*redirect/.test(x)), `expected redirect annotation: ${t}`);
});

test('extractInvariants: pulls hard rules from CLAUDE.md', () => {
  const d = tmp();
  write(d, 'CLAUDE.md', '# Rules\n\n- Do not weaken bid row locking or idempotency\n- Always run tests\n- Some normal note here that is long enough to pass\n');
  const inv = extractInvariants(d);
  assert(inv.some(x => /weaken bid row locking/.test(x)), `expected invariant: ${inv}`);
});

test('tokenize: drops generic stopwords', () => {
  const toks = tokenize('backend code quality is weak, plan and fix best-practice deviations');
  assert(!toks.includes('code') && !toks.includes('fix') && !toks.includes('backend'), `stopwords leaked: ${toks}`);
});

test('groundInRepo: empty dir is not grounded', () => {
  const d = tmp();
  assert.strictEqual(groundInRepo({ cwd: d, task: 'do something' }).grounded, false);
});

test('groundInRepo: falls back to source roots when no token match', () => {
  const d = tmp();
  write(d, 'backend/src/Main.java', 'class Main {}');
  const g = groundInRepo({ cwd: d, task: 'improve overall quality' });
  assert(g.roots.includes('backend/src'), `expected backend/src root: ${g.roots}`);
});

test('surfaceFromTargets/classifySurface: tsx targets → ui, java → service', () => {
  const ui = classifySurface(surfaceFromTargets(['a/page.tsx', 'b/Comp.tsx', 'c/x.jsx']));
  assert.strictEqual(ui.kind, 'ui');
  assert(ui.isUi && !ui.isService);
  const svc = classifySurface(surfaceFromTargets(['x/Foo.java', 'y/Bar.java']));
  assert.strictEqual(svc.kind, 'service');
});

test('groundInRepo: derives prefer from .tsx targets → JS build in a dual-build monorepo', () => {
  const d = tmp();
  // both build systems present; targets are frontend → must pick pnpm, not Gradle
  write(d, 'build.gradle', 'plugins {}');
  write(d, 'gradlew', '#!/bin/sh');
  write(d, 'frontend/package.json', JSON.stringify({ scripts: { lint: 'next lint', test: 'vitest' } }));
  write(d, 'frontend/pnpm-lock.yaml', 'lockfileVersion: 6');
  write(d, 'frontend/src/app/bidder/auctions/page.tsx', 'export default function P(){return null}');
  const g = groundInRepo({ cwd: d, task: 'review bidder auctions page' });
  assert.strictEqual(g.surface.kind, 'ui', `surface: ${JSON.stringify(g.surface)}`);
  assert.strictEqual(g.prefer, 'js');
  assert.strictEqual(g.build.tool, 'pnpm', `build: ${JSON.stringify(g.build)}`);
});

test('pickStackName: maps detected stack to CSV name by surface', () => {
  assert.strictEqual(pickStackName('/x', ['Spring Boot', 'Java 17'], 'service'), 'spring-boot');
  assert.strictEqual(pickStackName('/x', ['Next.js 16', 'MUI'], 'ui'), 'nextjs');
  assert.strictEqual(pickStackName('/x', ['Next.js 16'], 'data'), null);
});

test('extractInvariants: ranks task-relevant rule first, drops mentions + tooling notes', () => {
  const d = tmp();
  write(d, 'CLAUDE.md', [
    '## Architecture',
    '- application/ — use-case services, transaction boundaries, bid/timer/eligibility logic',
    '## Must Not Do',
    '- Do not weaken bid row locking, idempotency, rate limits, or timer validation.',
    '- Do not expose real bidder identity in bidder-facing API responses or UI.',
    '## Tooling',
    '- superpowers:dispatching-parallel-agents skill is always present in Claude Code sessions.',
    '## Files',
    '- application/timer/WorkingHoursService.java',
  ].join('\n'));
  const inv = extractInvariants(d, 'improve bid locking and idempotency');
  // a real rule mentioning the task tokens ranks first
  assert(/weaken bid row locking/.test(inv[0]), `expected locking rule first: ${JSON.stringify(inv)}`);
  // non-rule "mention" bullet (architecture list) is excluded
  assert(!inv.some(x => /use-case services/.test(x)), `architecture mention leaked: ${inv}`);
  // bare file path excluded
  assert(!inv.some(x => /WorkingHoursService\.java/.test(x)), `file path leaked: ${inv}`);
  // tooling note excluded
  assert(!inv.some(x => /dispatching-parallel/.test(x)), `tooling note leaked: ${inv}`);
});

console.log('');
