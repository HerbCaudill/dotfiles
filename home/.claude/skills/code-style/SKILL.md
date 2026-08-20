---
name: code-style
description: Use when writing or editing code in Herb's repos — file and folder organization, React component structure, JSDoc and comment conventions, functional style, test conventions, and when to reach for Effect.
---

# Code style

## File organization

- Every shared function/class/component should be in its own file. The file should have the name of the function/class/component, and in most cases that file should export only that function/class/component.
- Use named exports. Only use default exports where the framework (like Next.js) requires them.
- Types, constants and helpers that are only used by one function/class/component should live in the same file as the caller.
- Put tests and stories in `tests/` and `stories/` subdirectories alongside the source files they refer to:
- Shared types go in a `types.ts` file; shared constants go in a `constants.ts` file.

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
lib/
- tests/
  - toLowerCase.test.ts
- toLowerCase.ts
```

Within a file, follow this order:

1. Imports
2. Main function/class/component
3. Local helper functions
4. Local constants
5. Local types

## React components

- React components should always have a `Props` type, listed at the end of the file.
- When building lists of Tailwind class names programmatically, use `cx` (called `cn` in some repos) rather than string interpolation.

## Functional style

- Prefer pure functions over functions with side effects.
- Prefer immutable data; avoid mutating objects and arrays.
- Use `map`/`filter`/`reduce` for simple transforms; use loops when clearer or faster.
- Prefer function composition over class hierarchies.
- Keep side effects (I/O, state changes) at the edges of the system.

## Formatting

Use [`assets/.oxfmtrc.json`](assets/.oxfmtrc.json) as the default oxfmt configuration for new JavaScript and TypeScript repositories. Preserve existing repository configuration; do not replace intentional deviations unless the user asks.

When an `if` statement controls a single-line statement, put it on the same line without braces:

```ts
if (!body) return null
```

## Comments

Comments within the code should generally use `// ...`.

Don't be stingy with comments, but use them to explain why something is done, not what is done. Avoid comments that restate the code.

> ❌ Wrong
>
> This comment restates the code, and should use `//` instead of `/* */`:
>
> ```ts
> /* Calculate the next iteration state. */
> const nextState = getNextIterationState(currentState)
> ```

Use `/* ... */` for long introductory comments.

```ts
/*
I wish this class wasn't necessary, but the current implementation of the API requires it. 
The API is not well-documented, and the only way to figure out how to use it is to read the 
source code. This class wraps the API and provides a more convenient interface for our use 
case.   
*/
```

Every function, class, property, parameter, and method should be preceded by a JSDoc block comment starting with `/**`. Document function parameters independently, not using JSDoc `@param` syntax.

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

For multiline JSDoc comments, put the opening `/**` and closing `*/` on their own lines:

```ts
/**
 * Check if there's a recent saved iteration state that can be restored.
 * This is called on reconnection to determine whether to auto-resume.
 */
export async function checkForSavedIterationState(
  /**
   * The iteration instance. If no instance ID is provided, the active instance ID
   * from the app store will be used.
   */
  instanceId?: string,
): Promise<IterationState | null> {
  const targetInstanceId = instanceId ?? useAppStore.getState().activeInstanceId
  return getIterationState(targetInstanceId)
}
```

In a file with lots of local helpers, constants, types, etc., use a single section all-caps heading for each category, and separate the sections with a blank line.

```ts
// CONSTANTS

const PIZZA = "🍕"
// etc...

// TYPES

type Foo = {
  bar: string
  baz: number
}
// etc...
```

> ❌ Wrong
>
> Never wrap section headings in ASCII borders or banner boxes.
>
> ```ts
> /*
>    ==========================
>               TYPES
>    ==========================
> */
> ```

## Tests

Tests should assert behavior users or callers care about, not implementation details — avoid tests that check CSS class names, DOM nesting, or component internals.

When you remove functionality, remove the corresponding tests. Don't leave tests that assert that the functionality is gone.

Playwright selectors should be based on what users actually see and interact with: visible text, accessible roles, labels, and placeholders. When that's not possible, use domain data attributes like `data-player="name"` and `data-cell="row-col"`.

## Effect

Reach for [Effect](https://effect.website) when a problem has real structural complexity — typed/recoverable errors, dependency injection, concurrency, resource lifecycle (acquire/release), retries and timeouts, or pipelines where failures need to compose. Use Effect Schema for parsing, validation, and encode/decode at system boundaries.

Don't use Effect by default. Plain async/await and pure functions are better for simple scripts, one-off transforms, and small components — Effect's overhead (learning curve, syntax, bundle size) only pays off once the failure/dependency/concurrency story is genuinely hard. When in doubt, start plain and adopt Effect at the layer where the complexity actually lives. The `effect-ts` and `effect-schema` skills have the details.
