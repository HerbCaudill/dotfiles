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

- One component, one file. One function, one file.
- Shared types should be in a `types.ts` file
- Shared constants should be in a `constants.ts` file.
- React components should always have a `Props` type. The type definition should be at the end of the file.
- When combining lists of class names, use `cx` rather than string interpolation.
- Use named exports. Don't use default exports unless we're in a framework (like Next.js) that requires them
- Name test files `foo.test.ts`
- Don't put big headings in comments with ASCII borders:

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

## Dotfiles

The `~/Code/HerbCaudill/dotfiles` repo manages global configuration files using symlinks.

The `home/.claude/` directory contains Claude Code settings that are symlinked to `~/.claude/`:

- `CLAUDE.md` - Global instructions (this file)
- `settings.json` - Claude Code settings
- `statusline.js` - Custom status line configuration
- Skills in the `skills/` directory

Other files managed by this repo:

- `home/.zshrc` - Zsh configuration
- `home/.gitconfig` - Git settings
- `home/.gitignore` - Global gitignore
- `home/.asdfrc` - asdf version manager config
- `home/.prettierrc` - Prettier formatting defaults
- `home/.oh-my-zsh/custom/themes/herb.zsh-theme` - Custom Zsh theme
- Raycast scripts in the `raycast/` directory

**Important:** When modifying any of these files, make changes in the dotfiles repo, then commit and push.
