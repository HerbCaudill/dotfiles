---
name: skill-creator
description: Create or update a user-managed personal skill when Herb explicitly invokes this skill.
metadata:
  short-description: Create or update a personal skill
---

# Skill creator

Create and update personal skills in the dotfiles repository. Work in the canonical checkout at `~/Code/HerbCaudill/dotfiles` and write global skills to `home/.claude/skills/<skill-name>`. Never write directly to `~/.codex`, another harness's linked skill directory, or `.system`.

Preserve the user's intent, chosen scope, and authorization boundaries. Do not change unrelated skills, configuration, documentation, or external state. Ask a question only when a missing choice would materially change the result.

Before editing, read the target repository instructions and inspect a few relevant personal skills under `home/.claude/skills` for naming, frontmatter, structure, and writing conventions. Inspect an existing target skill before updating it.

Keep the skill focused and transparent. Use a concise `SKILL.md` with required `name` and `description` frontmatter. Prefer instruction-only skills. Add `scripts/`, `references/`, `assets/`, or `agents/openai.yaml` only when the requested behavior genuinely needs them. Make explicit-only invocation a policy setting only when the user requests it.

Include only guidance that changes decisions. Keep conditional detail in a supporting reference only when that makes the entrypoint meaningfully clearer. Do not add placeholder files, copied manuals, generic advice, or hidden behavior.

Validate the result in proportion to its contents. Parse the YAML, check the folder and skill names, verify referenced files, run new or changed scripts, and confirm skill discovery when possible. Inspect the final diff for scope and accidental artifacts.

Report exactly what changed, what was validated, and any reload or rebuild step needed for discovery.
