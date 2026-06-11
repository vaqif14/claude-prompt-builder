# [Prompt Builder](https://github.com/vaqif14/claude-prompt-builder)

<p align="center">
  <a href="https://www.npmjs.com/package/@vaqif14/prompt-builder"><img src="https://img.shields.io/npm/v/@vaqif14/prompt-builder?style=for-the-badge&color=blue&logo=npm" alt="npm version"></a>
  <img src="https://img.shields.io/badge/platforms-18-green?style=for-the-badge" alt="18 Platforms">
  <img src="https://img.shields.io/badge/modes-14-purple?style=for-the-badge" alt="14 Modes">
  <a href="https://github.com/vaqif14/claude-prompt-builder/blob/main/LICENSE"><img src="https://img.shields.io/github/license/vaqif14/claude-prompt-builder?style=for-the-badge&color=green" alt="License"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@vaqif14/prompt-builder"><img src="https://img.shields.io/npm/dm/@vaqif14/prompt-builder?style=flat-square&label=downloads" alt="npm downloads"></a>
  <a href="https://github.com/vaqif14/claude-prompt-builder/stargazers"><img src="https://img.shields.io/github/stars/vaqif14/claude-prompt-builder?style=flat-square&logo=github" alt="GitHub stars"></a>
</p>

Turn vague tasks like `"yoxla bu səhifəni"` or `"timer əlavə et"` into professional, paste-ready **agent orchestration prompts**. Auto-detects platform, discovers skills, assigns agents, and builds a task board.

> **Note:** the generated prompt is plain Markdown that any coding agent can consume, but it is **optimized for Claude Code and its skills ecosystem** (`find-skills`, `npx skills`, `/reload-skills`). On other agents the skill-install/load steps are simply optional recommendations.

---

## Progressive Disclosure

This project uses a layered documentation hierarchy. Start at the top and dive deeper as needed:

| Doc | Purpose | Start here if... |
|---|---|---|
| **[SKILL.md](./SKILL.md)** | Full usage guide: overview → quick start → examples → advanced topics | You are a new user or Claude Code skill consumer |
| **[QUICKREF.md](./QUICKREF.md)** | Cheat sheet: flags, modes, tables, code blocks | You already know the tool and need a fast lookup |
| **[REFERENCE.md](./REFERENCE.md)** | Deep dive: architecture, templates, checklists, extension points | You are writing custom prompts or extending the skill |
| **[ROADMAP.md](./ROADMAP.md)** | Source-backed 1.6.0 roadmap from Anthropic docs and X/Twitter ecosystem signals | You want the next professional feature plan |

> **For usage** → [SKILL.md](./SKILL.md)  
> **For quick reference** → [QUICKREF.md](./QUICKREF.md)  
> **For deep dive** → [REFERENCE.md](./REFERENCE.md)  
> **For next version** → [ROADMAP.md](./ROADMAP.md)

---

## Install

```bash
# One-shot (no install)
npx @vaqif14/prompt-builder "design pricing card component"

# Global install
npm install -g @vaqif14/prompt-builder
```

## Quick Example

```bash
# Auto-detect mode and platform
prompt-builder "review admin dashboard and confirm that all working"

# Explicit mode
prompt-builder --mode security-review "audit auth flow"

# Save to file
prompt-builder --save prompt.txt "refactor api"

# Token-budget aware generation
prompt-builder --max-tokens 2000 "design pricing card"

# Resume previous session
prompt-builder --session-id sess_xxx "continue implementation"
```

---

## Features

- **18 Platforms** — Web, Backend, iOS, Android, Flutter, React Native, Desktop, CLI, DevOps, AI/ML, and more
- **14 Prompt Modes** — feature, audit, bugfix, refactor, design-review, architecture-review, security-review, performance-review, release-check, prd-to-tasks, hackathon, agent-readiness, tooling-review, skill-review
- **Workflow Pattern Router** — Names the composable agent shape to run (single-pass, prompt-chain, routing, parallel-review, orchestrator-workers, evaluator-optimizer, autonomous-loop) — simple/composable before autonomous
- **Verification-First Contract** — Every claim split by its proof (source / command / browser-device / blocked-by); no proof → "Blocked", never an optimistic "Working"
- **Context Diet** — Scores each prompt `lean`/`ok`/`heavy`, flags bloat + missing cache, recommends `--max-tokens`
- **Selective Install Profiles** — `--profile web|backend|mobile|ai-agent|hackathon`: a small, capped, approval-required curated skill set (not a bulk mega-setup)
- **Mixed-Platform Lanes** — Auto-creates integration lane when multiple platforms detected
- **Skill Discovery Preflight** — Scans local skills + ecosystem search + install recommendations
- **Multi-Agent Task Board** — Task cards with id | owner | skill | title | status | depends_on | artifact
- **Validation V2** — Quality scoring (100 pts) + orthogonal solution/plan readiness axes
- **30+ Stack Profiles** — Stack-specific best practices, anti-patterns, and verification gates
- **Model Selection** — Auto-routes to Haiku/Sonnet/Opus by complexity (`--model` override)
- **Session Memory** — JSON-backed session store with resume (`--session-id`, `--list-sessions`)
- **Token Budgeting** — Context-aware section compression (`--max-tokens`, `--context-report`)
- **Security Hardening** — Untrusted task text neutralized (control/ANSI stripped, section-forging blocked), CSV sanitization, SHA-256 data manifest

---

## License

This project is licensed under the [MIT License](LICENSE).
