# prompt-builder

Architect-grade Claude Code skill that builds production-ready prompts by profiling the user, analyzing the codebase, and applying Claude Code Architecture certified patterns.

## Install

Copy `SKILL.md` and `REFERENCE.md` into your Claude Code skills directory:

```bash
# User scope
mkdir -p ~/.claude/skills/prompt-builder
cp SKILL.md REFERENCE.md ~/.claude/skills/prompt-builder/

# Or project scope
mkdir -p .claude/skills/prompt-builder
cp SKILL.md REFERENCE.md .claude/skills/prompt-builder/
```

## Trigger

Say any of:
- "prompt builder"
- "cursor prompt"
- "agent prompt"
- "professional prompt"
- "claude prompt"

## What it does

1. **User Profiling** — learns your stack, style, quality bar, anti-patterns
2. **Codebase Profiling** — maps architecture, patterns, tech debt
3. **Task Decomposition** — breaks request into atomic sub-tasks
4. **Prompt Architecture (CCAP)** — applies certified patterns:
   - System Contract (altitude)
   - Context Window (signal hygiene)
   - Tool Directives (orchestration)
   - Acceptance Gates (validation)
   - Output Schema (structure)
5. **Prompt Assembly** — delivers paste-ready prompt + Metadata Card

## Files

- `SKILL.md` — main skill instructions (keep under 100 lines)
- `REFERENCE.md` — deep reference: templates, checklists, anti-patterns, examples
