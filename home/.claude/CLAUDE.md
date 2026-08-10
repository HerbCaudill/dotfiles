# Global agent memory

> Sections tagged **\[macOS only\]** apply only on the macOS host. Ignore them in other environments (such as the Windows VM, which imports this file).

## About the user

My name is Herb Caudill. I'm an American citizen living in Barcelona. My wife, Lynne, is a therapist with a doctorate in anthropology; she specializes in maternal mental health. We have two boys: Calvin is 21; he's in college in the US. Ashe is 18 and is living at home while he plots his next move. We rent an apartment in Barcelona and own a house in Tamariu on the Costa Brava. I own a small software company, DevResults, which makes monitoring & evaluation software for foreign aid projects. It's a small company with 9 employees including me. I still work as a programmer, mostly in TypeScript. I speak English, Spanish, Catalan, and French.

## Response style

Be concise. Prefer natural, conversational prose, like a thoughtful technical collaborator speaking directly to me. Lead with a direct answer, then explain briefly. Keep the tone warm, intelligent, and straightforward, and avoid formulaic language.

Default to short paragraphs rather than headings or lists. Don't turn routine answers into outlines or reports. Use structure only when it materially improves clarity — step-by-step instructions, task lists, command lists, file lists, or comparing several options.

If you have questions for me, ask them one at a time.

When giving me a long command to run in the terminal, copy it to my clipboard as a single line so I don't get unwanted line breaks (`pbcopy` on macOS, `Set-Clipboard` on Windows).

I have a strong preference for sentence case over title case — whether in UI elements like labels or buttons, or headings in a document.

When writing markdown files, put each paragraph on a single line — no manual wrapping or hard line breaks within a paragraph.

## Technology choices

TypeScript, React, Vite, pnpm, oxfmt (replacing Prettier), Vitest, Playwright. Tabler icons and IBM Plex fonts.

When writing shell scripts, prefer TypeScript over bash, Python, or PowerShell.

Follow the `code-style` skill when writing or editing code.

## Workflow

When fixing a bug, diagnose first — reproduce or inspect the failure enough to understand the intended behavior, the likely cause, and whether a regression test is practical. Then use TDD for the fix. If the problem is exploratory, flaky, environmental, or caused by config/build/tooling rather than product behavior, investigate first and add tests only once there's stable behavior worth protecting.

Plans should end with unresolved questions, if any.

Unless I say otherwise, don't worry about backwards compatibility; use a hard cutover.

## Task tracking

Most of my repos use **bd (beads)** for issue tracking; you can tell by looking for a `.beads` directory in the root. In those repos, use `bd` rather than TodoWrite, TaskCreate, or markdown TODO lists. Create issues only when I ask or when the work is complex enough to benefit from breaking down — not for one-off tasks you're about to fix immediately.

## Using git and the filesystem

When work is complete, commit it, push it, and close the task if applicable.

Write commit messages with a concise subject line followed by a short paragraph explaining the context and reasoning behind the change.

Work is NOT complete until `git push` succeeds. If push fails, resolve and retry until it succeeds.

Within a repository, always use relative paths.

Never run destructive git operations (`git reset --hard`, `git checkout`/`git restore` to an older commit, `rm` of tracked files) without an explicit written instruction from me in this conversation.

Never revert or delete work you didn't author — other agents are often editing adjacent files, so coordinate instead of clobbering. That includes deleting a file to silence a local typecheck, lint, or test failure: stop and ask first.

Never amend commits without explicit written approval.

Moving, renaming, and restoring files is fine, as is deleting files that your own changes make obsolete.

## Memory files

Don't use Claude Code's per-project memory files (the `~/.claude/projects/.../memory/` directory, including `MEMORY.md`). Keep every persistent preference and instruction in CLAUDE.md instead — the repo's CLAUDE.md for project-specific guidance, or this global file for cross-repo preferences — so it's versioned, reviewable, and portable across agents (Claude Code, Codex, pi) and machines.

## Notes and transcripts

My Obsidian notes vault is at `~/Code/herbcaudill/notes`. The `daily/` folder contains daily notes, and the `meetings/` folder contains meeting transcripts.

## DevResults repo \[macOS only\]

Never operate on the mounted Windows checkout (`~/Code/devresults/devresults`) directly: no local editing tools, `apply_patch`, `git`, test commands, or formatters against `/Volumes/[C] Windows 11/...`. The `devresults` skill covers the working setup. (Note that this skill does NOT apply to sibling repos in `~/Code/devresults`.)

## Dotfiles \[macOS only\]

`~/Code/HerbCaudill/dotfiles` manages global configuration with Nix (nix-darwin plus home-manager). Shared agent instructions live in `home/.claude/CLAUDE.md` and are linked into Claude Code, Codex, and pi; shared skills live in `home/.claude/skills`. When modifying any managed global file, make the change in the dotfiles repo, not in the linked target under `~/`. See that repo's own CLAUDE.md for workflow details.

## Google Workspace \[macOS only\]

Google Drive local path: `~/Library/CloudStorage/GoogleDrive-herb@devresults.com/My Drive` (regular files only — Google Docs/Sheets/Slides are cloud-only stubs). The `gws-*` skills drive the `gws` CLI via Bash; no MCP server is needed. Only use `gws` for things you can't do with the tools exposed by Google's first-party plugins.
