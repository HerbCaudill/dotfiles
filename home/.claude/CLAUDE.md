In planning documents and other interactions, be as concise as possible.
If you have questions for me, ask them one at a time.

## Technology choices

I generally use:

- TypeScript
- React
- Vite
- pnpm

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

- Each function should be in its own file.
- Don't put multiple helper functions in a single file; put each function in its own file.
- Shared types should be in a `types.ts` file
- Shared constants should be in a `constants.ts` file.
- When combining lists of Tailwind class names, use `cx` rather than string interpolation.
- Use named exports. Don't use default exports unless we're in a framework (like Next.js) that requires them
- Name test files `foo.test.ts`

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
  const targetInstanceId = instanceId ?? useAppStore.getState().activeInstanceId
  return getIterationState(targetInstanceId)
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
  }
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
// ---- CodexAdapter ----
```

## Testing

- Use Vitest for unit testing and Playwright for end-to-end testing.
- When creating any new non-trivial function, use test-driven development (TDD).
- When using Playwright, selectors should be based on what users actually see and interact with: visible text, accessible roles, labels, and placeholders. When that's not possible, use domain data attributes like `data-player="name"` and `data-cell="row-col"`.

## Planning

- At the end of each plan, include a list of unresolved questions, if any.
- In planning mode, the output should always be (1) a plan document stored in the repository, and (2) a granular set of tasks. If the repository uses beads (`bd`) for issue management, you should file those tasks as issues, with appropriate dependencies, and grouped into epics as necessary. Otherwise put them in a `todo.md` file.

## Workflow

After completing a request:

- Make sure everything compiles and runs.
- Run unit tests.
- Run Playwright tests if applicable.
- Run `pnpm format` to format code with Prettier before committing.
- Commit the changes immediately without being asked. If a request requires a series of significant changes, make intermediate commits as well. Commit messages should succinctly summarize changes. Where applicable, prefix with the name of the primary class/function/component being edited, followed by a colon. Example: `EditTemplatePage: refactor data source handling`
- Update the project's documentation and CLAUDE.md file with new information or changes.

## Codex

- Global Codex instructions and skills are sourced from `home/.claude/CLAUDE.md` and `home/.claude/skills`.
- `install.mjs` replaces any existing `~/.codex/AGENTS.md` and `~/.codex/skills` with symlinks to those sources.

## Worktrees

The following shell commands are available:

| Command                   | Description                                |
| ------------------------- | ------------------------------------------ |
| `wt <branch> [base]`      | Create worktree with new branch            |
| `wtt <branch>`            | Create worktree tracking existing branch   |
| `wtcd [branch]`           | Navigate to worktree (no args = main repo) |
| `wtls`                    | List worktrees with status                 |
| `wtrm <branch> [-f] [-b]` | Remove worktree (`-b` also deletes branch) |
| `wtclean`                 | Remove worktrees for merged branches       |
| `wtclone <url> [name]`    | Clone repo optimized for worktrees         |

Worktrees for a repo will be placed in a sibling directory to the repo named `.{repo name}-worktrees`.

```bash
~/Code/herbcaudill/ralph # repository
~/Code/herbcaudill/.ralph-worktrees
```

## Using git and the filesystem

- When working within a repository, always use relative paths.
- Delete unused or obsolete files when your changes make them irrelevant (refactors, feature removals, etc.), and revert files only when the change is yours or explicitly requested. If a git operation leaves you unsure about other agents' in-flight work, stop and coordinate instead of deleting.
- **Before attempting to delete a file to resolve a local typecheck/lint/test failure, stop and ask the user.** Other agents are often editing adjacent files; deleting their work to silence an error is never acceptable without explicit approval.
- NEVER edit `.env` or any environment variable files — only the user may change them.
- Coordinate with the user or with other agents before removing their in-progress edits — don't revert or delete work you didn't author unless everyone agrees.
- Moving, renaming, nd restoring files is allowed.
- ABSOLUTELY NEVER run destructive git operations (e.g., `git reset --hard`, `rm`, `git checkout`/`git restore` to an older commit) unless the user gives an explicit, written instruction in this conversation. Treat these commands as catastrophic; if you are even slightly unsure, stop and ask before touching them.
- Never use `git restore` (or similar commands) to revert files you didn't author — coordinate with other agents instead so their in-progress work stays intact.
- Always double-check git status before any commit
- Keep commits atomic: commit only the files you touched and list each path explicitly.
- Never amend commits unless you have explicit written approval in the task thread.

## Dotfiles

The `~/Code/HerbCaudill/dotfiles` repo manages global configuration files using symlinks.

The `home/.claude/` directory contains Claude Code settings that are symlinked to `~/.claude/`:

- `CLAUDE.md` - Global instructions (this file)
- `settings.json` - Claude Code settings
- `statusline.js` - Custom status line configuration
- Skills in the `skills/` directory
- Agents in the `agents/` directory

## Agents

Custom agents are available in `~/.claude/agents/`. Each agent specifies its model via YAML frontmatter:

```yaml
---
model: haiku # or sonnet, opus
---
```

To invoke an agent manually, use the Task tool with `subagent_type: "general-purpose"` and the model specified in its frontmatter.

### review-style

Reviews TypeScript/React files against the code style rules in this document. Fixes violations directly using the Edit tool.

**Usage:** "Use the review-style agent on `src/components/UserCard.tsx`"

**What it checks:**

- One component/function per file
- Component first, types at end
- Named exports only
- Block comments on functions/classes
- No ASCII borders in comments
- `cx()` for Tailwind class combinations

## Skills

### /review-repo

Runs repo-wide code style review. Creates a worktree, reviews every TypeScript file with the review-style agent in parallel, then merges into main.

**Usage:** `/review-repo` from any git repository

### /safe-merge

Safely merges main into the current branch. Handles conflicts intelligently and verifies tests pass before completing.

**Usage:** `/safe-merge` from any git repository

## Serena (MCP)

Serena is an MCP server providing LSP-powered semantic code tools: `find_symbol`, `find_referencing_symbols`, `get_symbols_overview`, `replace_symbol_body`, `rename_symbol`, etc. It also has a persistent memory system for project context.

- Serena tools are available at the top level of a conversation but **not automatically available to subagents** (Explore, Bash, etc.). Only `general-purpose` subagents have access, and even then should be explicitly told to use them.
- For code navigation and refactoring, prefer Serena's semantic tools over text-based grep/find when precision matters (e.g. tracing references, understanding symbol relationships, renaming across a codebase).
- Activate a project with `activate_project` before use. Run `check_onboarding_performed` and `onboarding` on first use to populate memory files.

Other files managed by this repo:

- `home/.zshrc` - Zsh configuration
- `home/.gitconfig` - Git settings
- `home/.gitignore` - Global gitignore
- `home/.asdfrc` - asdf version manager config
- `home/.prettierrc` - Prettier formatting defaults
- `home/.oh-my-zsh/custom/themes/herb.zsh-theme` - Custom Zsh theme
- `home/.local/bin/` - Worktree helper scripts (symlinked to `~/.local/bin`)
- Raycast scripts in the `raycast/` directory

**Important:** When modifying any of these files, make changes in the dotfiles repo, then commit and push.
