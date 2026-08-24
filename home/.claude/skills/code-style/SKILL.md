---
name: code-style
description: Use when writing or editing code in Herb’s repositories. Covers file organization, React, functional style, formatting, comments, tests, and Effect.
---

# Code style

Follow repository conventions when they conflict with this default.

## Files

Give each shared function, class, or component its own same-named file and usually its own named export. Use default exports only when a framework requires them.

Keep private helpers, constants, and types with their caller. Put shared types in `types.ts` and shared constants in `constants.ts`. Place tests and stories in sibling `tests/` and `stories/` directories.

Order file contents as imports, main export, local helpers, local constants, then local types.

## React

Define a `Props` type for every component and put it at the end of the file. Build conditional Tailwind class lists with the repository’s `cx` or `cn` helper, not string interpolation.

## Functional style

Prefer pure functions, immutable data, composition, and side effects at system boundaries. Use `map`, `filter`, and `reduce` for clear transforms; use loops when they are clearer or faster.

## Formatting

Use [the default oxfmt configuration](assets/.oxfmtrc.json) in new JavaScript and TypeScript repositories. Preserve existing repository settings unless Herb asks to replace them.

Put a single controlled statement on the same line without braces:

```ts
if (!body) return null
```

## Comments

Use `//` comments to explain why code exists, not to restate what it does. Use `/* ... */` for a long introductory comment.

Add a `/** ... */` JSDoc comment to every function, class, property, parameter, and method. Keep the comment itself to a single line when possible, but always put it on its own line directly above the declaration – never on the same line as the code it documents, even for a parameter. Document parameters this way instead of using `@param`.

```ts
/** Get the current terminal size with sensible defaults. */
export function getTerminalSize(
  /** Output from Ink’s useStdout hook. */
  stdout: NodeJS.WriteStream | undefined,
) {
  return { columns: stdout?.columns ?? 80, rows: stdout?.rows ?? 24 }
}
```

In files with many helpers, constants, or types, separate categories with one plain all-caps line such as `// TYPES`. Do not use decorative banners.

## Tests

Assert behavior that users or callers care about, not CSS classes, DOM nesting, or other implementation details. When removing behavior, remove its tests rather than adding tests that assert its absence.

In Playwright, prefer visible text, accessible roles, labels, and placeholders. If those are insufficient, use domain-specific attributes such as `data-player="name"`.

## Effect

Use Effect when typed recoverable errors, dependency injection, concurrency, resource lifecycles, retries, timeouts, or composable failure pipelines justify its overhead. Use Effect Schema for validation and encoding at system boundaries.

Prefer plain async/await and pure functions for small components, simple scripts, and one-off transforms. Start plain when uncertain and introduce Effect where the structural complexity lives. See the `effect-ts` and `effect-schema` skills for details.
