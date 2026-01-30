---
name: effect-ts
description: Reference for the Effect TS library — typed functional effects, error handling, dependency injection, concurrency, and resource management.
---

# Effect TS Reference

## The Effect Type

```typescript
Effect<Success, Error, Requirements>
```

- **Success (A)**: Value produced on success
- **Error (E)**: Expected (typed) error. `never` = can't fail
- **Requirements (R)**: Dependencies needed. `never` = no dependencies

## Creating Effects

```typescript
import { Effect } from "effect"

// From known values
Effect.succeed(42)
Effect.fail(new Error("boom"))

// Lazy (deferred evaluation)
Effect.sync(() => Math.random())
Effect.try(() => JSON.parse(input))

// From promises
Effect.promise(() => fetch(url))
Effect.tryPromise({
  try: () => fetch(url),
  catch: (e) => new FetchError(e)
})

// Async with cancellation
Effect.async<string, Error>((resume) => {
  const controller = new AbortController()
  fetch(url, { signal: controller.signal })
    .then((res) => res.text())
    .then((text) => resume(Effect.succeed(text)))
    .catch((err) => resume(Effect.fail(new Error(String(err)))))
  return Effect.sync(() => controller.abort())
})
```

## Running Effects

```typescript
// Synchronous (throws on async or failure)
Effect.runSync(effect)

// Returns Exit (success or failure, no throw)
Effect.runSyncExit(effect)

// Promise-based
await Effect.runPromise(effect)
await Effect.runPromiseExit(effect)

// Fire and forget (returns Fiber)
Effect.runFork(effect)
```

## Generators (async/await style)

```typescript
const program = Effect.gen(function* () {
  const user = yield* getUser(id)
  const posts = yield* getPosts(user.id)
  return { user, posts }
})
```

- `yield*` unwraps an Effect (like `await` for promises)
- Errors short-circuit automatically (no try/catch needed at each step)
- The compiler tracks all error and requirement types through the generator

## Error Management

### Two Error Types

- **Expected errors** (`E`): Part of the type signature, recoverable. Created with `Effect.fail()`.
- **Unexpected errors** (defects): Not in the type signature, represent bugs. Created with `Effect.die()`.

### Tagged Errors

```typescript
class NotFound extends Data.TaggedError("NotFound")<{
  readonly id: string
}> {}

class Unauthorized extends Data.TaggedError("Unauthorized")<{
  readonly userId: string
}> {}

// Catch by tag
program.pipe(
  Effect.catchTag("NotFound", (e) => Effect.succeed(`Not found: ${e.id}`))
)

// Catch all expected errors
program.pipe(
  Effect.catchAll((e) => Effect.succeed("fallback"))
)

// Catch specific errors with a predicate
program.pipe(
  Effect.catchIf(
    (e): e is NotFound => e._tag === "NotFound",
    (e) => Effect.succeed("recovered")
  )
)
```

### Other Error Combinators

```typescript
// Map error type
Effect.mapError(effect, (e) => new OtherError(e.message))

// Provide a fallback effect
Effect.orElse(effect, () => fallbackEffect)

// Retry on failure
Effect.retry(effect, Schedule.recurs(3))

// Handle both success and failure
Effect.match(effect, {
  onSuccess: (a) => `ok: ${a}`,
  onFailure: (e) => `err: ${e}`
})
```

## Services & Dependency Injection

### Define a Service

```typescript
class Database extends Context.Tag("Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
  }
>() {}
```

### Use a Service

```typescript
const program = Effect.gen(function* () {
  const db = yield* Database
  const rows = yield* db.query("SELECT * FROM users")
  return rows
})
// Type: Effect<unknown[], never, Database>
```

### Provide a Service

```typescript
const DatabaseLive = Database.of({
  query: (sql) => Effect.sync(() => [])
})

// Provide to program
program.pipe(Effect.provideService(Database, DatabaseLive))
```

## Layers

Layers are recipes for building services, with automatic dependency resolution.

```typescript
// Simple layer (no dependencies)
const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.sync(() => [])
})

// Layer that needs an effect
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      query: (sql) => Effect.promise(() => pgQuery(config.url, sql))
    }
  })
)

// Layer with resource management (acquire/release)
const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => createPool()),
      (pool) => Effect.sync(() => pool.close())
    )
    return { query: (sql) => Effect.promise(() => pool.query(sql)) }
  })
)

// Compose layers
const AppLive = Layer.mergeAll(DatabaseLive, LoggerLive)

// Layer depending on another layer
const ServiceLive = Layer.provide(ServiceLayer, DependencyLayer)

// Run with layers
Effect.runPromise(
  program.pipe(Effect.provide(AppLive))
)
```

## Concurrency

### Fibers

```typescript
const program = Effect.gen(function* () {
  // Fork a fiber (non-blocking)
  const fiber = yield* Effect.fork(longRunningTask)

  // Do other work...

  // Wait for fiber result
  const result = yield* Fiber.join(fiber)

  // Or interrupt it
  yield* Fiber.interrupt(fiber)
})
```

### Concurrent Operations

```typescript
// Run effects concurrently, collect all results
const results = yield* Effect.all([effectA, effectB, effectC], {
  concurrency: "unbounded"
})

// Concurrent with limit
const results = yield* Effect.all(effects, { concurrency: 5 })

// ForEach with concurrency
const results = yield* Effect.forEach(
  items,
  (item) => processItem(item),
  { concurrency: 10 }
)

// Race: first to succeed wins
const fastest = yield* Effect.race(effectA, effectB)
```

## Resource Management

```typescript
// Acquire/release pattern
const managed = Effect.acquireRelease(
  Effect.sync(() => openConnection()),    // acquire
  (conn) => Effect.sync(() => conn.close()) // release (guaranteed)
)

// Use within a scope
const program = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* managed
    return yield* conn.query("SELECT 1")
  })
)

// Finalizers (always run, even on interruption)
const withCleanup = Effect.ensuring(
  myEffect,
  Effect.sync(() => cleanup())
)

// Add a finalizer to the current scope
Effect.addFinalizer(() => Effect.sync(() => console.log("cleaning up")))
```

## State Management with Ref

```typescript
const program = Effect.gen(function* () {
  const counter = yield* Ref.make(0)

  // Read
  const value = yield* Ref.get(counter)

  // Write
  yield* Ref.set(counter, 42)

  // Atomic update
  yield* Ref.update(counter, (n) => n + 1)

  // Update and return old value
  const old = yield* Ref.getAndUpdate(counter, (n) => n + 1)

  // Update and return new value
  const next = yield* Ref.updateAndGet(counter, (n) => n + 1)

  // Modify (update + derive a value)
  const derived = yield* Ref.modify(counter, (n) => [n * 2, n + 1])
})
```

## Streams

```typescript
import { Stream } from "effect"

// Type: Stream<A, E, R> — lazy, pull-based, possibly infinite
// Create
Stream.make(1, 2, 3)
Stream.fromIterable([1, 2, 3])
Stream.range(0, 10)
Stream.repeat(Effect.sync(() => Math.random()))
Stream.unfold(0, (n) => Option.some([n, n + 1]))

// Transform
stream.pipe(
  Stream.map((n) => n * 2),
  Stream.filter((n) => n > 5),
  Stream.take(10),
  Stream.mapEffect((n) => fetchData(n)),
  Stream.flatMap((n) => Stream.make(n, n + 1)),
  Stream.tap((n) => Effect.log(`Processing ${n}`))
)

// Consume
Stream.runCollect(stream)     // Effect<Chunk<A>>
Stream.runForEach(stream, fn) // Effect<void>
Stream.runFold(stream, init, f)
Stream.runDrain(stream)       // Ignore output
```

## Scheduling

```typescript
import { Schedule } from "effect"

// Retry 3 times
Effect.retry(effect, Schedule.recurs(3))

// Exponential backoff
Effect.retry(effect, Schedule.exponential("100 millis"))

// Combine schedules
Effect.retry(effect,
  Schedule.recurs(5).pipe(
    Schedule.intersect(Schedule.exponential("100 millis"))
  )
)

// Repeat on success
Effect.repeat(effect, Schedule.spaced("1 second"))
```

## Pipe vs Methods

```typescript
// Pipe style (preferred for composition)
Effect.succeed(1).pipe(
  Effect.map((n) => n + 1),
  Effect.flatMap((n) => Effect.succeed(n * 2))
)

// Standalone function style
pipe(
  Effect.succeed(1),
  Effect.map((n) => n + 1),
  Effect.flatMap((n) => Effect.succeed(n * 2))
)
```

## Common Patterns

### Program Structure

```typescript
// Define services
class Config extends Context.Tag("Config")<Config, { readonly apiUrl: string }>() {}
class Http extends Context.Tag("Http")<Http, { readonly get: (url: string) => Effect.Effect<string> }>() {}

// Build layers
const ConfigLive = Layer.succeed(Config, { apiUrl: "https://api.example.com" })
const HttpLive = Layer.effect(Http, Effect.gen(function* () {
  const config = yield* Config
  return { get: (path) => Effect.tryPromise(() => fetch(`${config.apiUrl}${path}`).then(r => r.text())) }
}))
const AppLive = HttpLive.pipe(Layer.provide(ConfigLive))

// Write program
const main = Effect.gen(function* () {
  const http = yield* Http
  return yield* http.get("/users")
})

// Run
Effect.runPromise(main.pipe(Effect.provide(AppLive)))
```

### Converting Promise-based Code

```typescript
// Before (Promise)
async function getUser(id: string): Promise<User> {
  const res = await fetch(`/users/${id}`)
  if (!res.ok) throw new Error("Not found")
  return res.json()
}

// After (Effect)
const getUser = (id: string) =>
  Effect.gen(function* () {
    const res = yield* Effect.tryPromise({
      try: () => fetch(`/users/${id}`),
      catch: () => new NetworkError()
    })
    if (!res.ok) return yield* Effect.fail(new NotFoundError({ id }))
    return yield* Effect.tryPromise({
      try: () => res.json() as Promise<User>,
      catch: () => new ParseError()
    })
  })
```

## Key Principles

- **Effects are values**: They describe computations but don't execute until run
- **Errors are typed**: The `E` parameter makes all failure modes explicit
- **Dependencies are tracked**: The `R` parameter ensures all requirements are provided
- **Composition over inheritance**: Use pipes, generators, and layers
- **Referential transparency**: Same effect description = same behavior
- **Resource safety**: `acquireRelease` and scopes guarantee cleanup
