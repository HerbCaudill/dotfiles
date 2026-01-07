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

- In general each component and every helper function should be in its own file with the same name.
- React components should always have a `Props` type. The type definition should be at the end of the file.
- When combining lists of class names, use `cx` rather than string interpolation.
- Use named exports. Don't use default exports unless we're in a framework (like Next.js) that requires them
- Name test files `foo.test.ts`

## Testing

- Use Vitest for unit testing and Playwright for end-to-end testing.
- When creating any new non-trivial function, use test-driven development (TDD).
- When using Playwright, selectors should be based on what users actually see and interact with: visible text, accessible roles, labels, and placeholders. When that's not possible, use domain data attributes like `data-player="name"` and `data-cell="row-col"`.
- When using Playwright, ONLY use the UI. NEVER tamper directly with persisted data in LocalStorage or anywhere else (except to clear it to keep tests isolated).

## Planning

- At the end of each plan, include a list of unresolved questions, if any.

## Workflow

After completing a request:

- Make sure everything compiles and runs.
- Run unit tests.
- Run Playwright tests if applicable.
- Commit the changes immediately without being asked. If a request requires a series of significant changes, make intermediate commits as well. Commit messages should succinctly summarize changes. Where applicable, prefix with the name of the primary class/function/component being edited, followed by a colon. Example: `EditTemplatePage: refactor data source handling`
- Update the project's documentation and CLAUDE.md file with new information or changes.
