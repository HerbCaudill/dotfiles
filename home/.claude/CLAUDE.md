In planning documents and other interactions, be as concise as possible.

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

Don't put big headings in comments with ASCII borders:

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

### safe-merge

Safely merges main into the current branch. Handles conflicts intelligently and verifies tests pass before completing.

**Usage:** "Use the safe-merge agent to update from main"

## Skills

### /review-repo

Runs repo-wide code style review. Creates a worktree, reviews every TypeScript file with the review-style agent in parallel, then merges into main.

**Usage:** `/review-repo` from any git repository

Other files managed by this repo:

- `home/.zshrc` - Zsh configuration
- `home/.gitconfig` - Git settings
- `home/.gitignore` - Global gitignore
- `home/.asdfrc` - asdf version manager config
- `home/.prettierrc` - Prettier formatting defaults
- `home/.oh-my-zsh/custom/themes/herb.zsh-theme` - Custom Zsh theme
- Raycast scripts in the `raycast/` directory

**Important:** When modifying any of these files, make changes in the dotfiles repo, then commit and push.
