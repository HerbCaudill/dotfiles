---
name: code-style
description: Use when writing or editing code in Herb's repos — file and folder organization, React component structure, JSDoc and comment conventions, functional style, test conventions, and when to reach for Effect.
---

# Code style

## File organization

- Keep an implementation helper in the file of its only intended production caller. It does not
  need to be exported or tested separately just because it is a named function.
- Extract a function when it has multiple production callers, represents an independently
  meaningful concept, establishes a useful architectural boundary, is expected to be reused, or
  would make its owning file hard to navigate. Current caller count is evidence, not a mechanical
  rule.
- When a function is extracted, `foo` lives in `some-directory/foo.ts` and its focused test file,
  when one is useful, lives in `some-directory/tests/foo.test.ts`.
- Shared types go in a `types.ts` file; shared constants go in a `constants.ts` file.
- Use named exports. Don't use default exports unless the framework (like Next.js) requires them.
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

## React components

- Each component should be in its own file; there should not be multiple components in a single file.
- An ordinary helper used only by one component may live in the component file. Put file-local
  helpers after the component and before local types.
- Components should always have a `Props` type, listed at the end of the file.
- The first thing I see in a component file, after the imports, should be the component itself.
- All local `interface` and `type` declarations should be at the end of the file.
- When combining lists of Tailwind class names, use `cx` (called `cn` in some repos) rather than string interpolation.

## Functional style

- Prefer pure functions over functions with side effects
- Prefer immutable data; avoid mutating objects and arrays
- Use `map`/`filter`/`reduce` for simple transforms; use loops when clearer or faster
- Prefer function composition over class hierarchies
- Keep side effects (I/O, state changes) at the edges of the system

## Formatting

Use [`assets/.oxfmtrc.json`](assets/.oxfmtrc.json) as the default oxfmt configuration for new JavaScript and TypeScript repositories. Preserve existing repository configuration; do not replace intentional deviations unless the user asks.

When an `if` statement controls a single-line statement, put it on the same line without braces:

```ts
if (!body) return null
```

## Comments

Every function, class, property, parameter, and method should be preceded by a block comment starting with `/**`. Document function parameters independently, not using jsdoc `@param` syntax.

Don't use `//` comments to document declarations. Use JSDoc block comments for those; keep `//` comments for inline implementation notes, section markers, or file-level context not attached to a specific declaration.

Keep JSDoc to a single line where possible:

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

When the comment wraps, put the opening `/**` and closing `*/` on their own lines:

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

Never wrap section headings in ASCII borders or banner boxes — a plain `// CodexAdapter` is enough.

## Tests

Tests should assert behavior users or callers care about, not implementation details — avoid tests that check CSS class names, DOM nesting, or component internals.

Playwright selectors should be based on what users actually see and interact with: visible text, accessible roles, labels, and placeholders. When that's not possible, use domain data attributes like `data-player="name"` and `data-cell="row-col"`.

## Effect

Reach for [Effect](https://effect.website) when a problem has real structural complexity — typed/recoverable errors, dependency injection, concurrency, resource lifecycle (acquire/release), retries and timeouts, or pipelines where failures need to compose. Use Effect Schema for parsing, validation, and encode/decode at system boundaries.

Don't use Effect by default. Plain async/await and pure functions are better for simple scripts, one-off transforms, and small components — Effect's overhead (learning curve, syntax, bundle size) only pays off once the failure/dependency/concurrency story is genuinely hard. When in doubt, start plain and adopt Effect at the layer where the complexity actually lives. The `effect-ts` and `effect-schema` skills have the details.
