# Global agent memory

In planning documents and other interactions, be as concise as possible.

If you have questions for me, ask them one at a time.

## Response style

When communicating with me, prefer natural, conversational prose in short paragraphs, like a thoughtful technical collaborator speaking directly to me. Lead with a direct answer, then explain briefly in prose. Keep the tone warm, intelligent, and straightforward. Avoid formulaic status-report language and avoid unnecessary structure.

Default to paragraphs rather than headings, bullet lists, numbered lists, tables, or checklist-style formatting. Do not turn routine answers into outlines or reports. Use headings or bullets only when they materially improve clarity, such as for step-by-step instructions, command lists, file lists, or when comparing multiple options.

## Technology choices

I generally use:

- TypeScript
- React
- Vite
- pnpm

When writing scripts, prefer TypeScript over bash, Python, PowerShell, etc.

## User interface

- Default to Tabler icons
- Default to IBM Plex fonts
- Button text, headings, and labels should be sentence-cased

## Code style

### React components

- Each component should be in its own file.
- There should not be multiple components in a single file.
- Helper functions should not be in the same file as components.
- React components should always have a `Props` type, listed at the end of the file.
- The first thing I see in a component file, after the imports, should be the component itself.
- All interfaces and type definitions should be at the end of the file.

### Functional style

- Prefer pure functions over functions with side effects
- Prefer immutable data; avoid mutating objects and arrays
- Use `map`/`filter`/`reduce` for simple transforms; use loops when clearer or faster
- Prefer function composition over class hierarchies
- Keep side effects (I/O, state changes) at the edges of the system

### General

- Unless instructed otherwise, don't worry about backwards compatibility; use a hard cutover approach.
- Each function should be in its own file.
- Don't put multiple helper functions in a single file; put each function in its own file.
- Shared types should be in a `types.ts` file
- Shared constants should be in a `constants.ts` file.
- When combining lists of Tailwind class names, use `cx` (or `cn`) rather than string interpolation.
- Use named exports. Don't use default exports unless we're in a framework (like Next.js) that requires them
- Name test files `foo.test.ts`
- Put tests and stories in `tests/` and `stories/` subdirectories alongside the source files they refer to:
  ```
  components/
  - tests/
    - Foo.test.ts
    - Bar.test.ts
  - stories/
    - Foo.stories.ts
    - Bar.stories.ts
  - Foo.tsx
  - Bar.tsx
  ```

### Comments

Every function, class, property, parameter, method, etc. should be preceded by a block comment starting with `/**`. Function parameters should be documented independently, not using jsdoc syntax.

```ts
/**
 * Check if there's a recent saved iteration state that can be restored.
 * This is called on reconnection to determine whether to auto-resume.
 */
export async function checkForSavedIterationState(
  /** The iteration instance */
  instanceId?: string,
): Promise<IterationState | null> {
  const targetInstanceId = instanceId ?? useAppStore.getState().activeInstanceId;
  return getIterationState(targetInstanceId);
}
```

Keep this to a single line if possible.

```ts
/** Get the current terminal size with sensible defaults. */
export function getTerminalSize(
  /** The stdout object from Ink's useStdout hook */
  stdout: any,
) {
  return {
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  };
}
```

NEVER put big headings in comments with ASCII borders:

```ts
// ❌ don't do this
// =============================================================================
// CodexAdapter
// =============================================================================

// ❌ don't do this
// ┌────────────────────────────────┐
// │          CodexAdapter          │
// └────────────────────────────────┘

// ✅ easy does it
// CodexAdapter
```

## Testing

- Use Vitest for unit testing and Playwright for end-to-end testing.
- When modifying TypeScript code, use test-driven development (TDD).
- Do not require TDD for trivial config edits, shell aliases, documentation-only changes, or other simple mechanical edits with no executable logic.
- When using Playwright, selectors should be based on what users actually see and interact with: visible text, accessible roles, labels, and placeholders. When that's not possible, use domain data attributes like `data-player="name"` and `data-cell="row-col"`.

## Planning

- At the end of each plan, include a list of unresolved questions, if any.
- In planning mode, the output should always be (1) a plan document numbered and stored in the repository under `/plans`, and (2) a granular set of tasks. If the repository uses beads (`bd`) for issue management, you should file those tasks as issues, with appropriate dependencies, and grouped into epics as necessary. Otherwise put them in a `todo.md` file.

## Task tracking

Most of my repos use **bd (beads)** for issue tracking. You can tell by looking for a `.beads` directory in the root. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready                                     # Find available work
bd create --title="..." --description="..."  # Create issue
bd show <id>                                 # View issue details
bd update <id> --claim                       # Claim work
bd close <id>                                # Complete work
```

### Rules

- In beads-enabled repos, use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Work is NOT complete until `git push` succeeds. NEVER stop before pushing - that leaves work stranded locally. NEVER say "ready to push when you are" - YOU must push. If push fails, resolve and retry until it succeeds.
- Only create tasks when the user explicitly asks or the work is complex enough to benefit from breaking down into multiple steps. DO NOT create beads issues for one-off tasks that you are going to fix immediately.

## Trivial changes

Trivial localized changes should use the lightest reasonable workflow. A change is trivial if it is obvious and low-risk, affects a small number of files, does not require design exploration, and does not introduce meaningful new logic or architecture.

For trivial changes:

- do not use brainstorming or planning skills
- only use TDD for code changes
- do not update documentation or CLAUDE files unless the change affects durable guidance

## Workflow

When creating new functionality or fixing bugs, write tests first. Use the `Test-Driven Development (TDD)` skill. When fixing a bug, before doing anything else, start by writing a test that reproduces the bug. Then fix the bug and prove it with a passing test.

After completing a request:

- Make sure everything compiles and runs.
- Run unit tests.
- Run Playwright tests if applicable.
- Run `pnpm format` to format code with Prettier before committing.
- Commit the changes immediately without being asked. If a request requires a series of significant changes, make intermediate commits as well. Commit messages should succinctly summarize changes. Where applicable, prefix with the name of the primary class/function/component being edited, followed by a colon. Example: `EditTemplatePage: refactor data source handling`
- Update the project's documentation and CLAUDE.md file when the change affects durable behavior, workflows, setup, or instructions.

## Codex and pi

- Global Codex and pi instructions and skills are sourced from `home/.claude/CLAUDE.md` and `home/.claude/skills`.
- `scripts/symlink.mjs` replaces any existing `~/.codex/AGENTS.md`, `~/.codex/skills`, `~/.pi/agent/AGENTS.md`, and `~/.pi/agent/skills` with symlinks to those shared sources.

## Worktrees

The following shell commands are available:

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `wt <branch> [base]`      | Create worktree with new branch                |
| `wtt <branch>`            | Create worktree tracking existing branch       |
| `wtcd [branch]`           | Navigate to worktree (no args = main repo)     |
| `wtls`                    | List worktrees with status                     |
| `wtrm <branch> [-f] [-k]` | Remove worktree and branch (`-k` keeps branch) |
| `wtclean`                 | Remove worktrees for merged branches           |
| `wtclone <url> [name]`    | Clone repo optimized for worktrees             |

Worktrees for a repo will be placed in a sibling directory to the repo named `.{repo name}-worktrees`.

```bash
~/Code/herbcaudill/ralph # repository
~/Code/herbcaudill/.ralph-worktrees
```

## Using git and the filesystem

- When working within a repository, always use relative paths.
- Delete unused or obsolete files when your changes make them irrelevant (refactors, feature removals, etc.), and revert files only when the change is yours or explicitly requested. If a git operation leaves you unsure about other agents' in-flight work, stop and coordinate instead of deleting.
- **Before attempting to delete a file to resolve a local typecheck/lint/test failure, stop and ask the user.** Other agents are often editing adjacent files; deleting their work to silence an error is never acceptable without explicit approval.
- Coordinate with the user or with other agents before removing their in-progress edits — don't revert or delete work you didn't author unless everyone agrees.
- Moving, renaming, and restoring files is allowed.
- ABSOLUTELY NEVER run destructive git operations (e.g., `git reset --hard`, `rm`, `git checkout`/`git restore` to an older commit) unless the user gives an explicit, written instruction in this conversation. Treat these commands as catastrophic; if you are even slightly unsure, stop and ask before touching them.
- Never use `git restore` (or similar commands) to revert files you didn't author — coordinate with other agents instead so their in-progress work stays intact.
- Always double-check git status before any commit
- Keep commits atomic: commit only the files you touched and list each path explicitly.
- Never amend commits unless you have explicit written approval in the task thread.

## Dotfiles

The `~/Code/HerbCaudill/dotfiles` repo manages global configuration files using symlinks from `home/` into `~/`.

Key points:

- shared agent instructions live in `home/.claude/CLAUDE.md` and are symlinked into Claude Code, Codex, and pi
- shared skills live in `home/.claude/skills`
- when modifying any managed global file, make the change in the dotfiles repo, not in the symlink target under `~/`
- see the dotfiles repo's local `CLAUDE.md` for repo-specific workflow details

## Google Workspace CLI (`gws`)

Use the `gws` CLI (via Bash) to interact with Google Drive, Google Tasks, and other Workspace services. No MCP server needed — just call `gws` commands directly.

```bash
# Drive
gws drive files list --params '{"q": "name contains \"report\"", "pageSize": 10}'
gws drive files get --fileId <id>
gws drive +upload ./file.pdf          # helper shortcut

# Tasks
gws tasks tasklists list
gws tasks tasks list --tasklist <id>
gws tasks tasks insert --tasklist <id> --params '{"title": "Do the thing"}'

# Export Google Docs content (native Docs can't be read as files)
gws drive files export --fileId <id> --mimeType text/plain
gws drive files export --fileId <id> --mimeType application/pdf
```

Google Drive local path: `~/Library/CloudStorage/GoogleDrive-herb@devresults.com/My Drive` (regular files only — Google Docs/Sheets/Slides are cloud-only stubs).
