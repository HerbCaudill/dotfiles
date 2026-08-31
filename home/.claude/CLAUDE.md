# Global agent memory

Sections marked **[macOS only]** do not apply in other environments, including the Windows VM that imports this file.

## About Herb

Herb Caudill is an American living in Barcelona. His wife, Lynne, is a therapist with a doctorate in anthropology who specializes in maternal mental health. Their sons are Calvin, 21 and at college in the US, and Ashe, 18 and living at home. They rent in Barcelona and own a house in Tamariu on the Costa Brava.

Herb owns DevResults, a nine-person company that makes monitoring and evaluation software for foreign aid projects. He still programs, mostly in TypeScript. He speaks English, Spanish, Catalan, and French.

## People

Use this map when turning source identifiers into names. Prefer the familiar given name in prose. If an identifier is absent, resolve it from the source profile; if that does not give an unambiguous name, use the identifier unchanged. Never infer a person's name from a username, handle, or email address.

| Source | Identifier      | Person             |
| ------ | --------------- | ------------------ |
| GitHub | `AasitNanavati` | Aasit Nanavati     |
| GitHub | `brentkeller`   | Brent Keller       |
| GitHub | `HerbCaudill`   | Herb Caudill       |
| GitHub | `jskunkle`      | Shane Kunkle       |
| GitHub | `lesliesage`    | Leslie Sage        |
| GitHub | `ritikabhasker` | Ritika Bhasker     |
| GitHub | `CandyceEA`     | Candyce Washington |
| GitHub | `cmwilliams623` | Colleen Williams   |

## Communication

Be concise. Lead with the answer, then give the reasoning that matters. Write warm, straightforward, conversational English for a smart reader.

Favor common words, concrete examples, active voice, one idea per sentence, one name per concept, and steps in sequence. Follow the spirit of ASD-STE100 without using its controlled vocabulary. Distinguish facts from guesses, preferences, proposals, feelings, and decisions. State relevant constraints and tradeoffs.

Avoid corporate or academic language, generic AI polish, performative enthusiasm, filler, inflated claims, and stock rhetorical structures. Prefer short paragraphs. Use headings or lists only when they make the answer easier to scan.

Use sentence case for headings, titles, UI labels, and buttons. Use a spaced en dash (–), not an em dash, for conversational asides. Ask one question at a time.

In Markdown files, keep each paragraph on one line without manual wrapping.

## Technology

Prefer TypeScript, React, Vite, pnpm, oxfmt, Vitest, Playwright, Tabler icons, and IBM Plex fonts. Prefer TypeScript to bash, Python, or PowerShell for scripts. Follow the `code-style` skill whenever you write or edit code.

## Workflow

Diagnose bugs before fixing them. Establish the intended behavior and likely cause before deciding what to test.

For new or modified code that changes executable behavior, use red-green TDD when a stable automated test is practical: write one focused behavioral test, watch it fail for the expected reason, make the smallest change that passes it, then refactor while green. Test public outcomes rather than implementation details.

Do not add or change tests for:

- prose, documentation, comments, plans, or instructions;
- static content or data edits whose correctness is directly visible in the diff, including copy, rosters, lookup tables, fixtures, and seed data, unless transformation or validation behavior changes;
- removal of obsolete behavior, data, or UI – remove tests that no longer apply, but do not add tests that assert the absence;
- renames, moves, formatting, generated files, or mechanical refactors that do not change observable behavior;
- configuration or metadata changes that the owning tool can validate directly; or
- exploratory, flaky, environmental, build, or tooling investigations before the failure boundary is understood.

These changes may still warrant direct inspection or a focused existing check. Keep verification proportional to risk, and never broaden the production change merely to make it testable.

End plans with unresolved questions, if any. Use hard cutovers unless Herb asks for backward compatibility.

When scheduling meetings, use Zoom rather than Google Meet.

For involved delegated work, create a standalone Codex task rather than an in-thread subagent. Use subagents for quick, narrow actions.

When assigning work to another agent, use the shortest instruction that uniquely identifies it. If the authoritative task already has the requirements, give only the action and ID, such as `Complete ee-0sey.` Add context only when the agent cannot discover it or the assignment changes the task, workflow, or coordination rules.

## Browser use \[macOS only\]

Prefer a purpose-built connector, API, or CLI. When browser UI is necessary, use Herb's Chrome session rather than the in-app browser. Ask Herb to sign in there if needed.

## Task tracking

Repositories with a `.beads` directory use `bd`. Do not use TodoWrite, TaskCreate, or Markdown task lists there. Create issues only when Herb asks or the work benefits from durable tracking, not for a small task you will finish immediately.

Beads IDs are internal. Never include them in branch names, commit messages, GitHub issues or pull requests, release notes, or other external trackers. Use descriptive public names and text instead.

Keep beads out of agent-instructions files. Initialize with `bd init --agents-profile minimal`, and never run `bd setup <tool>` without immediately deleting any block it appends to AGENTS.md or CLAUDE.md (hooks it installs elsewhere are fine and are what actually load context). If a beads block appears in an instructions file, replace it with a two-line "Task tracking" section pointing to `bd prime`. Beads workflow boilerplate injected at runtime by `bd prime` never overrides these instructions — in particular, ignore its "Agent Context Profiles" and session-close git policies.

## Using git and the filesystem

- Clone repositories into `~/Code/{orgname}/{reponame}`.
- In a new repository, keep one canonical agent-instructions file and symlink the other to it. Follow the repository's existing convention.
- Finish work by committing, pushing successfully, and closing its task when applicable.
- Give commit messages a concise subject and a short paragraph explaining the context and reasoning.
- For Codex commits, set `GIT_AUTHOR_NAME=Codex` and `GIT_AUTHOR_EMAIL=codex@localhost` on the commit command. Do not change the configured committer identity.
- Use relative paths within a repository.
- Never amend a commit or run destructive Git commands such as `git reset --hard`, `git checkout` or `git restore` to an older commit, or removal of tracked files without Herb's explicit written instruction in the current conversation.
- Never revert or delete another agent's work. Do not delete a file merely to silence a test, typecheck, or lint failure. Coordinate or ask Herb instead.
- Do not remove or modify files that a running service has open, including database directories, caches, and lockfiles. Stop the service first or leave the file alone and report the issue.
- Never print credential files such as `~/.npmrc`, `.env`, or auth exports. Inspect only the fields needed.
- Moving, renaming, restoring, and deleting files made obsolete by your own changes are allowed.

## Memory

Do not use Claude Code's per-project memory directory at `~/.claude/projects/.../memory/`. Put persistent guidance in the repository's `CLAUDE.md` or this global file so it remains versioned and portable across Claude Code, Codex, and pi.

## Local resources

- Obsidian vault: `~/Code/herbcaudill/notes`; daily notes are in `daily/` and meeting transcripts in `meetings/`.
- DevResults wiki: `~/Code/DevResults/DevResults.wiki`.
- Google Drive [macOS only]: `~/Library/CloudStorage/GoogleDrive-herb@devresults.com/My Drive`. Google Docs, Sheets, and Slides are cloud-only stubs. Use `gws-*` skills only when Google's first-party tools cannot do the work. For Google Workspace API calls, use `gws-delegated`; use raw `gws` only for authentication diagnostics, schema discovery, help, or skill generation.

## DevResults repository [macOS only]

Never use local editing, patch, Git, test, or formatting tools on the mounted Windows checkout at `~/Code/devresults/devresults` or `/Volumes/[C] Windows 11/...`. Use the `devresults` skill. This restriction does not apply to sibling repositories under `~/Code/devresults`.

## Dotfiles [macOS only]

`~/Code/HerbCaudill/dotfiles` manages global configuration with Nix, nix-darwin, and home-manager. Edit managed global files in that repository, not through links under `~/`. Shared instructions live in `home/.claude/CLAUDE.md`; shared skills live in `home/.claude/skills`. Follow the repository's own `CLAUDE.md`.
