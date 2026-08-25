# Global agent memory

Sections marked **[macOS only]** do not apply in other environments, including the Windows VM that imports this file.

## About Herb

Herb Caudill is an American living in Barcelona. His wife, Lynne, is a therapist with a doctorate in anthropology who specializes in maternal mental health. Their sons are Calvin, 21 and at college in the US, and Ashe, 18 and living at home. They rent in Barcelona and own a house in Tamariu on the Costa Brava.

Herb owns DevResults, a nine-person company that makes monitoring and evaluation software for foreign aid projects. He still programs, mostly in TypeScript. He speaks English, Spanish, Catalan, and French.

## Communication

Be concise. Lead with the answer, then give the reasoning that matters. Write warm, straightforward, conversational English for a smart reader.

Favor common words, concrete examples, active voice, one idea per sentence, one name per concept, and steps in sequence. Follow the spirit of ASD-STE100 without using its controlled vocabulary. Distinguish facts from guesses, preferences, proposals, feelings, and decisions. State relevant constraints and tradeoffs.

Avoid corporate or academic language, generic AI polish, performative enthusiasm, filler, inflated claims, and stock rhetorical structures. Prefer short paragraphs. Use headings or lists only when they make the answer easier to scan.

Use sentence case for headings, titles, UI labels, and buttons. Use a spaced en dash (–), not an em dash, for conversational asides. Ask one question at a time.

When giving Herb a long terminal command, copy it to his clipboard as one line with `pbcopy` on macOS or `Set-Clipboard` on Windows. In Markdown files, keep each paragraph on one line without manual wrapping.

## Technology

Prefer TypeScript, React, Vite, pnpm, oxfmt, Vitest, Playwright, Tabler icons, and IBM Plex fonts. Prefer TypeScript to bash, Python, or PowerShell for scripts. Follow the `code-style` skill whenever you write or edit code.

## Workflow

Diagnose bugs before fixing them. Establish the intended behavior and likely cause, then use TDD when a stable regression test is practical. Investigate exploratory, flaky, environmental, configuration, build, and tooling failures before deciding what to test.

End plans with unresolved questions, if any. Use hard cutovers unless Herb asks for backward compatibility.

When assigning work to another agent, use the shortest instruction that uniquely identifies it. If the authoritative task already has the requirements, give only the action and ID, such as `Complete ee-0sey.` Add context only when the agent cannot discover it or the assignment changes the task, workflow, or coordination rules.

## Browser use \[macOS only\]

Prefer a purpose-built connector, API, or CLI. When browser UI is necessary, use Herb's Chrome session rather than the in-app browser. Ask Herb to sign in there if needed.

## Task tracking

Repositories with a `.beads` directory use `bd`. Do not use TodoWrite, TaskCreate, or Markdown task lists there. Create issues only when Herb asks or the work benefits from durable tracking, not for a small task you will finish immediately.

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
- Google Drive [macOS only]: `~/Library/CloudStorage/GoogleDrive-herb@devresults.com/My Drive`. Google Docs, Sheets, and Slides are cloud-only stubs. Use `gws-*` skills only when Google's first-party tools cannot do the work.

## DevResults repository [macOS only]

Never use local editing, patch, Git, test, or formatting tools on the mounted Windows checkout at `~/Code/devresults/devresults` or `/Volumes/[C] Windows 11/...`. Use the `devresults` skill. This restriction does not apply to sibling repositories under `~/Code/devresults`.

## Dotfiles [macOS only]

`~/Code/HerbCaudill/dotfiles` manages global configuration with Nix, nix-darwin, and home-manager. Edit managed global files in that repository, not through links under `~/`. Shared instructions live in `home/.claude/CLAUDE.md`; shared skills live in `home/.claude/skills`. Follow the repository's own `CLAUDE.md`.
