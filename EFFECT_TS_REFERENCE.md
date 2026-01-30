# Effect TS Comprehensive Reference

## Table of Contents

1. [Introduction & Core Concepts](#introduction--core-concepts)
2. [The Effect Type](#the-effect-type)
3. [Creating Effects](#creating-effects)
4. [Running Effects](#running-effects)
5. [Using Generators](#using-generators)
6. [Error Management](#error-management)
7. [Services & Dependency Injection](#services--dependency-injection)
8. [Layers](#layers)
9. [Concurrency & Fibers](#concurrency--fibers)
10. [Resource Management](#resource-management)
11. [Streams](#streams)
12. [State Management with Ref](#state-management-with-ref)

---

## Introduction & Core Concepts

### What is Effect?

Effect is a powerful TypeScript library designed to help developers easily create complex, synchronous, and asynchronous programs. It provides a comprehensive framework for building scalable, maintainable applications with strong type safety.

### Core Features

1. **Concurrency Model**: Built on fiber-based architecture enabling highly-scalable, ultra low-latency applications

2. **Composability Principle**: Software construction through small, reusable building blocks that enhance maintainability and readability

3. **Resource Safety**: Automated management of resource acquisition and release, ensuring proper cleanup even during failures

4. **Type System Integration**: Leverages TypeScript's type capabilities with emphasis on type inference and type safety

5. **Structured Error Handling**: Handle errors in a structured and reliable manner through built-in mechanisms

6. **Synchronous/Asynchronous Abstraction**: Write code with identical syntax whether operations are synchronous or asynchronous

7. **Observability**: Full tracing capabilities supporting debugging and execution monitoring

### Mental Model

Think of Effect as a way to describe programs rather than execute them immediately. Effects are:

- **Immutable**: Every operation produces a new Effect value
- **Descriptive**: Effects model interactions without performing them
- **Lazy**: No execution occurs until the Effect Runtime System interprets the value
- **Single Entry Point**: Ideally executed once at your application's main entry

---

## The Effect Type

### Core Definition

The `Effect` type represents a **lazy description of a workflow or operation** that doesn't execute immediately. It describes programs that can succeed, fail, or require additional context.

### Type Signature

```typescript
Effect<Success, Error, Requirements>
```

### Three Type Parameters

| Parameter | Purpose |
|-----------|---------|
| **Success** | The value type returned on successful execution; `void` means no output, `never` means infinite/non-terminating |
| **Error** | Expected errors that may occur; `never` indicates the effect cannot fail |
| **Requirements** | Contextual dependencies stored in a `Context` collection; `never` means no dependencies needed |

**Common Abbreviations**: These parameters are frequently shortened to `A` (success), `E` (error), and `R` (requirements) in Effect ecosystem code.

### Mental Model

Think of `Effect` as an effectful function: `(context: Context<Requirements>) => Error | Success`. However, effects aren't actual functions—they model "synchronous, asynchronous, concurrent, and resourceful computations."

### Extracting Inferred Types

Use utility types to extract individual type parameters:

```typescript
type SuccessType = Effect.Success<YourEffect>
type ErrorType = Effect.Error<YourEffect>
type ContextType = Effect.Context<YourEffect>
```

---

## Creating Effects

### Success/Failure Constructors

#### Effect.succeed

**Purpose**: Creates an Effect that always succeeds with a given value.

**Type Signature**: `<A>(value: A) => Effect<A, never, never>`

**When to Use**: When you need an effect representing successful completion without errors or dependencies.

**Example**:
```typescript
const success = Effect.succeed(42)
// Effect<number, never, never>
```

#### Effect.fail

**Purpose**: Creates an Effect representing a recoverable error.

**Type Signature**: `<E>(error: E) => Effect<never, E, never>`

**When to Use**: To explicitly signal errors in an Effect that will propagate unless handled.

**Example**:
```typescript
const failure = Effect.fail(new Error("Operation failed due to network error"))
// Effect<never, Error, never>
```

Supports tagged errors for better type tracking:
```typescript
class HttpError extends Data.TaggedError("HttpError")<{}> {}
const program = Effect.fail(new HttpError())
```

---

### Synchronous Effects

#### Effect.sync

**Purpose**: Represents a synchronous side-effect computation guaranteed not to fail.

**Type Signature**: `<A>(thunk: () => A) => Effect<A, never, never>`

**When to Use**: For synchronous operations you're certain won't throw exceptions. Exceptions become defects.

**Example**:
```typescript
const log = (message: string) =>
  Effect.sync(() => {
    console.log(message)
  })
```

#### Effect.try

**Purpose**: Handles synchronous operations that might fail.

**Type Signature**: `<A>(thunk: () => A) => Effect<A, UnknownException, never>`

**When to Use**: When performing synchronous operations like JSON parsing that could throw exceptions.

**Example**:
```typescript
const parse = (input: string) =>
  Effect.try(() => JSON.parse(input))
```

**Custom Error Handling**:
```typescript
const parse = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (error: unknown) =>
      new Error(`something went wrong ${error}`)
  })
```

---

### Asynchronous Effects

#### Effect.promise

**Purpose**: Represents an asynchronous computation guaranteed to succeed.

**Type Signature**: `<A>(evaluate: (signal: AbortSignal) => PromiseLike<A>) => Effect<A, never, never>`

**When to Use**: When the underlying Promise will never reject.

**Example**:
```typescript
const delay = (message: string) =>
  Effect.promise<string>(() =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(message)
      }, 2000)
    })
  )
```

#### Effect.tryPromise

**Purpose**: Handles asynchronous operations that might fail.

**Type Signature**: `<A>(evaluate: (signal: AbortSignal) => PromiseLike<A>) => Effect<A, UnknownException, never>`

**When to Use**: For operations like API calls that could reject. Catches errors automatically as `UnknownException`.

**Example**:
```typescript
const getTodo = (id: number) =>
  Effect.tryPromise(() =>
    fetch(`https://jsonplaceholder.typicode.com/todos/${id}`)
  )
```

**Custom Error Mapping**:
```typescript
const getTodo = (id: number) =>
  Effect.tryPromise({
    try: () => fetch(`https://jsonplaceholder.typicode.com/todos/${id}`),
    catch: (unknown) => new Error(`something went wrong ${unknown}`)
  })
```

---

### Callback-Based Asynchronous Effects

#### Effect.async

**Purpose**: Creates an Effect from callback-style asynchronous functions.

**Type Signature**: `<A, E>(resume: (callback: (effect: Effect<A, E, never>) => void, signal: AbortSignal) => void | Effect<void, never, never>) => Effect<A, E, never>`

**When to Use**: Wrapping legacy callback APIs that don't support Promises.

**Example**:
```typescript
const readFile = (filename: string) =>
  Effect.async<Buffer, Error>((resume) => {
    NodeFS.readFile(filename, (error, data) => {
      if (error) {
        resume(Effect.fail(error))
      } else {
        resume(Effect.succeed(data))
      }
    })
  })
```

**With Cleanup on Interruption**:
```typescript
const writeFileWithCleanup = (filename: string, data: string) =>
  Effect.async<void, Error>((resume) => {
    const writeStream = NodeFS.createWriteStream(filename)
    writeStream.write(data)
    writeStream.on("finish", () => resume(Effect.void))
    writeStream.on("error", (err) => resume(Effect.fail(err)))

    return Effect.sync(() => {
      console.log(`Cleaning up ${filename}`)
      NodeFS.unlinkSync(filename)
    })
  })
```

---

### Summary Table

| Method | Sync/Async | Error Handling | Use Case |
|--------|-----------|---|----------|
| `succeed` | Sync | None | Immediate success |
| `fail` | Sync | Explicit | Immediate failure |
| `sync` | Sync | Defects only | Safe sync operations |
| `try` | Sync | Caught exceptions | Operations that may throw |
| `promise` | Async | None | Safe promises |
| `tryPromise` | Async | Caught rejections | Potentially failing promises |
| `async` | Async | Custom | Legacy callback APIs |

---

## Running Effects

Effect provides multiple functions to execute effects, each suited for different scenarios. The choice depends on whether you need synchronous execution, promise-based handling, or background fiber management.

### Effect.runSync

**Purpose**: Execute effects synchronously, returning results directly.

**Signature**:
```typescript
runSync<A, E>(effect: Effect<A, E, never>): A
```

**When to use**:
- Effects that are purely synchronous with no failures
- You need immediate, direct results
- Asynchronous operations aren't involved

**Key behavior**: Throws errors if the effect fails or includes async operations.

**Example**:
```typescript
const program = Effect.sync(() => {
  console.log("Hello, World!")
  return 1
})
const result = Effect.runSync(program) // Output: Hello, World!
```

**Limitations**: Attempting to run effects that involve asynchronous operations or failures will result in exceptions being thrown.

---

### Effect.runSyncExit

**Purpose**: Run effects synchronously and return an Exit type representing success or failure.

**Signature**:
```typescript
runSyncExit<A, E>(effect: Effect<A, E, never>): Exit<A, E>
```

**When to use**:
- Handling both success and failure outcomes structurally
- Working with purely synchronous effects
- Inspecting detailed failure causes

**Exit type variants**:
- `Success(value)` - successful completion
- `Failure(cause)` - contains Cause with error details

**Example**:
```typescript
console.log(Effect.runSyncExit(Effect.succeed(1)))
// { _id: "Exit", _tag: "Success", value: 1 }

console.log(Effect.runSyncExit(Effect.fail("error")))
// { _id: "Exit", _tag: "Failure", cause: {...} }
```

**Async behavior**: Returns `Failure` with `Die` cause when encountering async operations, rather than throwing.

---

### Effect.runPromise

**Purpose**: Execute effects and return Promise-based results.

**Signature**:
```typescript
runPromise<A, E>(
  effect: Effect<A, E, never>,
  options?: { readonly signal?: AbortSignal }
): Promise<A>
```

**When to use**:
- Integrating with promise-based code
- Need standard Promise semantics
- Working with third-party libraries expecting Promises

**Behavior**:
- Resolves with success value
- Rejects with error information on failure

**Example**:
```typescript
Effect.runPromise(Effect.succeed(1)).then(console.log) // Output: 1

Effect.runPromise(Effect.fail("error")).catch(console.error)
// (FiberFailure) Error: error
```

**Cancellation**: Supports optional `AbortSignal` for cancellation control.

---

### Effect.runPromiseExit

**Purpose**: Execute effects returning Promises that resolve to Exit types.

**Signature**:
```typescript
runPromiseExit<A, E>(
  effect: Effect<A, E, never>,
  options?: { readonly signal?: AbortSignal }
): Promise<Exit<A, E>>
```

**When to use**:
- Need detailed error handling with Promise integration
- Distinguishing between success and failure outcomes
- Systems requiring both promise compatibility and structured result handling

**Advantages**: Never rejects; always resolves to an Exit, allowing "unified way" to examine outcomes.

**Example**:
```typescript
Effect.runPromiseExit(Effect.succeed(1)).then(console.log)
// { _id: "Exit", _tag: "Success", value: 1 }

Effect.runPromiseExit(Effect.fail("error")).then(console.log)
// { _id: "Exit", _tag: "Failure", cause: {...} }
```

---

### Effect.runFork

**Purpose**: Execute effects in the background via lightweight fiber execution.

**Signature**:
```typescript
runFork<A, E>(
  effect: Effect<A, E, never>,
  options?: RunForkOptions
): RuntimeFiber<A, E>
```

**When to use**:
- Background or long-running operations
- Effects requiring observation or interruption
- Concurrent workflows where immediate results aren't needed
- "Unless you specifically need a Promise or synchronous operation, runFork is a good default choice"

**Returns**: `RuntimeFiber` enabling background monitoring and lifecycle management.

**Example**:
```typescript
const fiber = Effect.runFork(program)

setTimeout(() => {
  Effect.runFork(Fiber.interrupt(fiber))
}, 500) // Stop execution after 500ms
```

**Capabilities**: Fibers can be observed for progress, interrupted, or joined for results.

---

### Best Practices

1. **Default to async**: For most cases, asynchronous execution should be the default via `runPromise` or `runFork`
2. **Use `runSync` sparingly**: Reserve synchronous execution for confirmed edge cases
3. **Edge placement**: Run effects at application boundaries, typically with a single main call
4. **Choose appropriately**: Match execution method to your concurrency and error-handling needs

---

## Using Generators

Effect provides `Effect.gen`, a utility that enables writing effectful code using JavaScript generator functions, offering syntax similar to `async`/`await` while maintaining explicit control over effect execution.

### Understanding Effect.gen

The `Effect.gen` API simplifies effectful code by utilizing generator functions. This approach "helps your code appear and behave more like traditional synchronous code, which enhances both readability and error management."

**Key usage pattern**:
```typescript
const program = Effect.gen(function* () {
  const value = yield* someEffect
  return finalResult
})
```

Three essential steps:
1. Wrap logic in `Effect.gen`
2. Use `yield*` to handle effects
3. Return the final result

### How yield* Works

The `yield*` operator extracts values from effects within the generator. When any yielded effect fails, the generator stops execution and propagates the error.

### Comparison with async/await

While syntactically similar, these approaches differ fundamentally:

| Aspect | Effect.gen | async/await |
|--------|-----------|-------------|
| **Composition** | Works with Effect type | Works with Promises |
| **Control** | Explicit effect control | Implicit await behavior |
| **Error Handling** | Integrated into Effect type | Try/catch pattern |

The generator-based approach offers more granular control over concurrent operations and error propagation.

### Control Flow Support

A significant advantage is native support for standard control structures directly within generators:

- Conditional logic (`if`/`else`)
- Loops (`for`, `while`)
- Break and continue statements
- Pattern matching

This eliminates the need for separate combinators for basic control flow.

### Error Handling

#### Short-Circuiting Behavior

Execution halts at the first error encountered. The documentation states: "the generator will stop and exit with that failure" when any yielded effect fails.

#### Introducing Errors

Errors are introduced using `Effect.fail`:

```typescript
const program = Effect.gen(function* () {
  yield* task1
  yield* Effect.fail("error message")
  // Following code never executes
})
```

#### Type Narrowing Consideration

After a failing yield, explicitly return to help TypeScript narrow types:

```typescript
if (user === undefined) {
  return yield* Effect.fail("User not found")
}
// Now TypeScript knows user is defined
```

### Advanced Features

#### Passing `this` Context

For methods, pass the object reference as the first argument:

```typescript
class MyClass {
  compute = Effect.gen(this, function* () {
    // Access this.property directly
  })
}
```

#### Using the Adapter Parameter

The resume/adapter parameter provides additional effect composition capabilities for advanced use cases.

### Requirements

**TypeScript Configuration**: The generator API requires either:
- `downlevelIteration` flag enabled, OR
- `target` set to `"es2015"` or higher

### Practical Example

```typescript
const program = Effect.gen(function* () {
  const amount = yield* fetchTransactionAmount
  const rate = yield* fetchDiscountRate
  const discounted = yield* applyDiscount(amount, rate)
  const final = addServiceCharge(discounted)
  return `Final: ${final}`
})
```

This demonstrates sequential composition of asynchronous operations with error handling automatically managed through the Effect type system.

### Optional Feature Note

The use of generators is an optional feature in Effect. Developers preferring alternative patterns can use pipeline-based composition instead.

---

## Error Management

### Two Types of Errors

Effect distinguishes between two categories of program failures:

**Expected Errors** are anticipated failures developers plan for during normal execution. They're tracked at the type level in the Effect's error channel, similar to checked exceptions. For example: `Effect<string, HttpError, never>` clearly indicates the program may fail with an `HttpError`.

**Unexpected Errors** are unanticipated failures outside normal program flow, resembling unchecked exceptions. Effect **does not track** them at the type level. However, the Effect runtime does keep track of these errors.

#### Key Differences

| Aspect | Expected | Unexpected |
|--------|----------|-----------|
| **Anticipation** | Part of domain and control flow | Lie outside expected behavior |
| **Type Tracking** | Yes (in Error channel) | No |
| **Runtime Handling** | Developer-managed recovery | Runtime tracks and provides recovery methods |
| **Alternative Names** | Failures, typed/recoverable errors | Defects, untyped/unrecoverable errors |

---

### Expected Errors

Expected errors are tracked at the type level through Effect's error channel. The Effect type signature captures error possibilities:

```typescript
Effect<Success, Error, Requirements>
```

The `Effect` type captures not only what the program returns on success but also what type of error it might produce.

#### Creating Expected Errors

Use `Data.TaggedError` to create discriminated error types:

```typescript
class HttpError extends Data.TaggedError("HttpError")<{}> {}
class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

const program = Effect.gen(function* () {
  if (someCondition) {
    yield* Effect.fail(new HttpError())
  }
  return "success"
})
```

#### Error Tracking

Effect automatically tracks multiple error types as unions:

```typescript
// Effect<string, HttpError | ValidationError, never>
```

#### Short-Circuiting Behavior

When errors occur, subsequent operations are skipped. APIs like `Effect.gen` and `Effect.flatMap` "short-circuit the execution upon encountering the first error."

---

### Catching All Errors

#### Effect.either

Transforms errors into an Either type, making both success and failure explicit:

```typescript
const recovered = Effect.gen(function* () {
  const result = yield* Effect.either(program)
  return Either.match(result, {
    onLeft: (error) => `Recovered from ${error._tag}`,
    onRight: (value) => value
  })
})
```

#### Effect.option

Wraps outcomes in Option, converting failures to `Option.none`:

```typescript
const maybe = Effect.option(Effect.succeed(1))
// Results in Option.some(1) on success, Option.none on failure
```

#### Effect.catchAll

Provides fallback recovery logic for all errors:

```typescript
const recovered = program.pipe(
  Effect.catchAll((error) =>
    Effect.succeed(`Handled: ${error._tag}`)
  )
)
```

**Note**: Only handles recoverable errors, not defects.

#### Effect.catchAllCause

Handles both recoverable errors and unrecoverable defects by working with the Cause type.

---

### Catching Specific Errors

#### Effect.catchSome

Selectively handles certain error conditions:

```typescript
Effect.catchSome((error) => {
  if (error._tag === "HttpError") {
    return Some(Effect.succeed("recovered"))
  }
  return None()
})
```

#### Effect.catchIf

Handles errors matching a predicate:

```typescript
Effect.catchIf(
  (error) => error._tag === "HttpError",
  (error) => Effect.succeed("recovered")
)
```

#### Effect.catchTag

Targets errors by their discriminant field:

```typescript
Effect.catchTag("HttpError", (error) =>
  Effect.succeed(`HTTP Error handled`)
)
```

#### Effect.catchTags

Handles multiple error types:

```typescript
Effect.catchTags({
  HttpError: (error) => Effect.succeed("handled http"),
  ValidationError: (error) => Effect.succeed("handled validation")
})
```

---

### Key Principles

- Expected errors are part of the type system, enabling compile-time visibility
- The discriminant `_tag` field distinguishes between error types
- Short-circuiting prevents wasteful continued execution after failures
- Different combinators provide granular control over which errors to handle

---

## Services & Dependency Injection

### Core Concepts

**Service**: A reusable component providing specific functionality across an application. Services encapsulate operations, interact with external systems, and handle specialized tasks while remaining modular and decoupled.

**Tag**: A unique identifier representing a service, allowing Effect to locate and use it at runtime. The identifier ensures global consistency, particularly useful during live reloads.

**Context**: A collection functioning like a map with tags as keys and service implementations as values, storing all services an effect may require.

### Defining a Service

Services are created using `Context.Tag` with two requirements:

1. A unique identifier (string)
2. A type describing the service's operations

```typescript
class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Effect.Effect<number> }
>() {}
```

The tag acts as a representation of the service and enables Effect to manage it across the application.

### Accessing Services in Effects

Services are accessed within effects by yielding the tag. Using `Effect.gen`:

```typescript
const program = Effect.gen(function* () {
  const random = yield* Random
  const randomNumber = yield* random.next
  console.log(`random number: ${randomNumber}`)
})
```

The type signature becomes `Effect<void, never, Random>`, indicating the `Random` requirement in the Requirements parameter.

Alternatively, using `pipe` with `Effect.andThen`:

```typescript
Random.pipe(
  Effect.andThen(random => random.next),
  Effect.andThen(randomNumber => Effect.sync(() => console.log(randomNumber)))
)
```

### Providing Service Implementations

Services are provided using `Effect.provideService`, which links the tag to its concrete implementation:

```typescript
const runnable = Effect.provideService(program, Random, {
  next: Effect.sync(() => Math.random())
})
```

After provision, the Requirements parameter becomes `never`, indicating all dependencies are satisfied.

### Multiple Services

When multiple services are required, the Requirements parameter becomes a union:

```typescript
const program = Effect.gen(function* () {
  const random = yield* Random
  const logger = yield* Logger
  const randomNumber = yield* random.next
  return yield* logger.log(String(randomNumber))
})
```

Services are provided individually or combined into a single Context using `Effect.provide`.

### Extracting Service Types

Use `Context.Tag.Service` to retrieve the service type from a tag:

```typescript
type RandomShape = Context.Tag.Service<Random>
// Equivalent to: { readonly next: Effect.Effect<number> }
```

### Dependency Injection Pattern

Effect's approach abstracts manual service handling, leveraging the type system to:
- Declare dependencies directly in function signatures
- Ensure compiler verification of all dependencies
- Maintain clean, decoupled architecture
- Enable easy testing and swapping implementations

The model eliminates manual parameter passing through multiple function layers while preserving type safety and composability.

---

## Layers

### What Are Layers?

Layers are abstractions for constructing services and managing their dependencies during the construction phase rather than at the service level. "Layers act as **constructors for creating services**, allowing us to manage dependencies during construction rather at the service level."

The Layer type has this structure:
```typescript
Layer<RequirementsOut, Error, RequirementsIn>
```

Where:
- **RequirementsOut**: The service being created
- **Error**: Possible errors during construction
- **RequirementsIn**: Dependencies required to construct the service

### Creating Layers

#### Layer.succeed

For services with no dependencies, use `Layer.succeed`:

```typescript
const ConfigLive = Layer.succeed(
  Config,
  Config.of({
    getConfig: Effect.succeed({
      logLevel: "INFO",
      connection: "mysql://..."
    })
  })
)
```

This produces `Layer<Config, never, never>` — no requirements, no errors.

#### Layer.effect

For services requiring dependencies, use `Layer.effect`:

```typescript
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (message) => Effect.gen(function* () {
        const { logLevel } = yield* config.getConfig
        console.log(`[${logLevel}] ${message}`)
      })
    }
  })
)
```

This produces `Layer<Logger, never, Config>` — requires Config service.

#### Layer.scoped

For resources needing cleanup:

```typescript
Layer.scoped(
  Database,
  Effect.gen(function* () {
    const connection = yield* acquireConnection
    yield* Effect.addFinalizer(() => closeConnection(connection))
    return Database.of({ query: (sql) => ... })
  })
)
```

### Combining Layers

#### Merging Layers

Combine independent layers using `Layer.merge`:

```typescript
const AppConfigLive = Layer.merge(ConfigLive, LoggerLive)
// Produces: Layer<Config | Logger, never, never>
```

Merging unions the inputs and outputs of both layers.

#### Composing Layers

Chain dependent layers where one requires another's output:

```typescript
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    const logger = yield* Logger
    return { query: (sql) => ... }
  })
)
// Produces: Layer<Database, never, Config | Logger>
```

#### Merging and Composing

Combine both strategies for complex dependency graphs:

```typescript
const AppLive = Layer.merge(
  Layer.merge(ConfigLive, LoggerLive),
  DatabaseLive
)
```

### Providing Layers to Effects

Use `Effect.provide` to supply layers to effects:

```typescript
const program = Effect.gen(function* () {
  const db = yield* Database
  return yield* db.query("SELECT * FROM users")
})

const runnable = Effect.provide(program, AppLive)
Effect.runPromise(runnable)
```

The layer automatically constructs all required services before execution.

### Key Patterns

**Avoid Requirement Leakage**: Service interfaces should have `Requirements = never`. Dependencies belong in layer constructors, not service signatures.

**Naming Convention**: Use "Live" suffix for production implementations and "Test" for test implementations (e.g., `DatabaseLive`, `DatabaseTest`).

**Dependency Graph Management**: Layers excel at organizing complex dependency trees without polluting service interfaces with construction details.

---

## Concurrency & Fibers

### What Are Fibers?

Fibers are lightweight virtual threads managed by the Effect runtime. Since JavaScript is single-threaded, fibers simulate concurrent execution through the event loop. "A fiber is created any time an effect is run. When running effects concurrently, a fiber is created for each concurrent effect."

Each fiber has:
- Unique identities and local state
- A well-defined lifecycle tied to its effect
- A status (running, suspended, or done)
- Resolution as either success or failure

### The Fiber Data Type

The `Fiber<Success, Error>` type represents a handle on executing an effect. It indicates whether a fiber succeeds with a value or fails with an error, but contains no requirements type parameter since effects have already been provisioned before execution.

### Forking Effects

**Forking** starts an effect in a new fiber and returns a reference to it:

```typescript
const fib10Fiber = Effect.fork(fib(10))
```

"The forked fiber is attached to the parent fiber's scope" with automatic supervision—when the parent terminates, child fibers are also terminated. Alternatives like `forkDaemon` and `forkIn` provide different supervision behaviors.

### Joining and Awaiting Fibers

**Joining** with `Fiber.join` waits for completion and retrieves the result:

```typescript
const n = yield* Fiber.join(fiber)
```

**Awaiting** with `Fiber.await` returns an Exit value with detailed completion information:

```typescript
const exit = yield* Fiber.await(fiber)
```

The Exit type encapsulates success, failure, or interruption details.

### Interruption Model

Effect uses **asynchronous interruption**—a fully functional approach where "a fiber is allowed to terminate another fiber" without requiring polling. Critical sections can disable interruptibility for safety.

#### Interrupting Fibers

`Fiber.interrupt` stops a fiber and runs finalizers:

```typescript
const exit = yield* Fiber.interrupt(fiber)
```

By default, this waits for termination. For background interruption, use `Effect.fork(Fiber.interrupt(fiber))` or the shorthand `Fiber.interruptFork`.

---

### Effect.all - Concurrent Execution

`Effect.all` combines multiple effects into a single effect, supporting tuples, iterables, structs, and records. It executes sequentially by default and stops on the first error ("short-circuiting").

Key characteristics:
- **Default behavior**: Results in a new effect containing the results as a tuple
- **Flexible input**: Works with various data structures
- **Error handling**: Supports three modes—default (short-circuit), "either" (collect all results), and "validate" (use Option type)

### Concurrency Options

Effect provides a `concurrency` property that accepts:

| Option | Behavior |
|--------|----------|
| **Default (none)** | Sequential execution—each effect starts only after the previous completes |
| **Number** (e.g., `2`) | Limits concurrent tasks; "allows up to two effects to run at the same time" |
| **"unbounded"** | "No limit to the number of effects running concurrently" |
| **"inherit"** | Inherits concurrency from surrounding context via `Effect.withConcurrency()` |

#### Sequential Execution Example

Without options, tasks run one after another. Task 2 only starts after Task 1 completes.

```typescript
const program = Effect.all([task1, task2, task3])
```

#### Numbered Concurrency Example

Setting `concurrency: 2` creates a queue where two tasks run simultaneously:

```typescript
const program = Effect.all([task1, task2, task3], { concurrency: 2 })
```

#### Unbounded Concurrency Example

All tasks launch immediately with no limit:

```typescript
const program = Effect.all([task1, task2, task3], { concurrency: "unbounded" })
```

#### Inherit Pattern

Uses `concurrency: "inherit"` to adopt settings from parent contexts:

```typescript
const program = Effect.all([task1, task2, task3], { concurrency: "inherit" })
```

### Effect.forEach

Effect.forEach traverses an array of values, applying an effectful computation to each of them:

```typescript
const program = Effect.forEach(
  [1, 2, 3, 4, 5],
  (n) => Effect.sync(() => n * 2),
  { concurrency: 3 }
)
```

Supports the same concurrency options as `Effect.all`.

### Error Handling Modes

- **Default**: Stops execution upon first error
- **"either"**: Collects both successes and failures, returning an array of Either instances
- **"validate"**: Uses Option to indicate success or failure

### Important Note

Pay attention: do not forget to specify the concurrency options to the Effect.all combinator, or else you will be surprised by a not-so-ideal performance of your programs.

### When Fibers Run

All effects in Effect are executed by fibers. If you didn't create the fiber yourself, it was created by an operation you're using (if it's concurrent) or by the Effect runtime system. Even single-threaded code executes within at least one "main" fiber.

---

## Resource Management

### Overview

Effect provides comprehensive resource management tools to ensure resources like database connections, file handles, and network requests are properly acquired, used, and released—even when errors occur.

### Key Finalization Constructs

#### Effect.ensuring

Guarantees a finalizer effect runs regardless of outcome (success, failure, or interruption). Useful for cleanup actions like closing file handles or releasing locks, but doesn't provide access to the effect's result.

#### Effect.onExit

Runs cleanup after the main effect completes, receiving an Exit value describing the outcome. The cleanup executes uninterruptibly, making it ideal for complex, high-concurrency scenarios. It provides detailed information about whether the effect succeeded, failed, or was interrupted.

#### Effect.onError

Attaches cleanup that runs only when the calling effect fails, receiving the failure cause. This enables targeted error recovery and resource cleanup based on specific failure types. The cleanup remains uninterruptible.

### acquireUseRelease Pattern

The primary resource management function follows this structure:

```typescript
Effect.acquireUseRelease(acquire, use, release)
```

**Three-phase operation:**
1. **Acquire** - Obtains the resource
2. **Use** - Performs intended operations
3. **Release** - Cleans up, guaranteed even on errors

**Example scenario:**
```typescript
const program = Effect.acquireUseRelease(
  acquire: getMyResource(),           // obtains resource
  use: (res) => log(`content: ${res}`), // uses resource
  release: (res) => res.close()        // releases resource
)
```

This pattern ensures resources are released reliably, handling failure cases automatically while maintaining clean separation between acquisition, usage, and cleanup logic.

### Scopes

The Scope data type is a core construct in Effect for managing resources in a safe and composable way. A scope represents the lifetime of one or more resources. When the scope is closed, all the resources within it are released, ensuring that no resources are leaked.

#### Key Features

**acquireRelease Pattern**:
Use `Effect.acquireRelease` to guarantee a resource's cleanup logic runs, even if errors or interruptions occur.

**Scope Functionality**:
Scopes allow the addition of finalizers, which define how to release resources. A finalizer specifies the cleanup logic for a resource. When the scope is closed, all resources are released, and the finalizers are executed.

**Automatic Cleanup**:
This function ensures that all resources used within an effect are tied to its lifetime. Finalizers for these resources are executed automatically when the effect completes, whether through success, failure, or interruption. This guarantees proper resource cleanup without requiring explicit management.

**Finalizer Behavior**:
The finalizer executes whenever the scope of the effect is closed, regardless of whether the effect succeeds, fails, or is interrupted. The finalizer receives the Exit value of the effect's scope, allowing it to react differently depending on how the effect concludes. Finalizers are a reliable way to manage resource cleanup, ensuring that resources such as file handles, network connections, or database transactions are properly closed even in the event of an unexpected interruption or error.

---

## Streams

### What is a Stream?

A `Stream<A, E, R>` represents a program description that can emit **zero or more values** of type `A`, handle errors of type `E`, and operate within a context type `R`. It extends the concept of `Effect` by enabling multiple value emissions rather than a single result.

### Key Type Parameters

- **A**: The value type emitted by the stream
- **E**: The error type that may occur
- **R**: The context/environment required

### Relationship to Effect

While `Effect<A, E, R>` always produces exactly one result, `Stream<A, E, R>` provides flexibility with multiple possible outcomes:

"While an `Effect<A, E, R>` represents a program that requires a context of type `R`, may encounter an error of type `E`, and always produces a single result of type `A`, a `Stream<A, E, R>` takes this further by allowing the emission of zero or more values of type `A`."

### Stream Scenarios

Streams can represent:
- **Empty streams**: No values emitted
- **Single-element streams**: Exactly one value
- **Finite streams**: Multiple values with defined endpoints
- **Infinite streams**: Unbounded value sequences

### Use Cases

Streams serve as replacements for observables, Node.js streams, and AsyncIterables, making them ideal for handling sequences of values over time.

---

### Creating Streams

#### Common Constructors

**Stream.make** - Creates a pure stream from a sequence of values:
```typescript
const stream = Stream.make(1, 2, 3)
```

**Stream.empty** - Produces a stream with no values, useful for representing empty sequences.

**Stream.range** - Constructs a stream from a range of integers, including both endpoints. Generates sequential numbers within `[min, max]`.

**Stream.iterate** - Generates an infinite stream by repeatedly applying a function to an initial value, producing `a, f(a), f(f(a))...`

**Stream.scoped** - Creates a single-valued stream from a scoped resource, handling acquisition and release automatically.

#### From Various Sources

**Stream.fromChunk/fromChunks** - Converts one or multiple `Chunk` objects into stream form.

**Stream.fromEffect** - Either emits the success value of this effect or terminates the stream with the failure value. Transforms Effect workflows into streams.

**Stream.fromIterable** - Converts standard iterables (arrays, sets) into streams.

**Stream.async** - Adapts asynchronous callback-based functions to emit multiple values as streams, enabling integration with legacy callback patterns.

**Stream.fromAsyncIterable** - Converts async iterables into Effect streams.

#### Advanced Patterns

Streams support creation through repetition, unfolding/pagination, queues, pubsub channels, and schedules. These patterns enable building complex data pipelines from various sources while maintaining lazy evaluation and backpressure handling.

---

### Stream Operations

#### Core Operations

**Transformation Operations:**
- `Stream.tap` - Executes side effects on each element without altering the stream
- `Stream.map` - Applies a function to transform each element
- `Stream.as` - Replaces all values with a constant
- `Stream.mapEffect` - Applies effectful transformations, supporting concurrency options

**Element Selection:**
- `Stream.take(n)` - Extracts a fixed number of elements
- `Stream.takeWhile(predicate)` - Keeps elements while condition holds
- `Stream.takeUntil(predicate)` - Extracts until condition is met
- `Stream.takeRight(n)` - Takes final n elements

#### Advanced Combinators

**Stream Composition:**
- `Stream.toPull` - Returns an effect for manual chunk-by-chunk consumption, useful for loop-based processing
- `Stream.filter` - Removes elements not matching a predicate
- `Stream.scan` - Maintains accumulated state while transforming
- `Stream.flatMap` - Chains multiple streams together

**Multi-Stream Operations:**
- `Stream.zip` - Combines corresponding elements from multiple streams
- `Stream.merge` - Combines streams concurrently
- `Stream.interleave` - Alternates elements between streams
- `Stream.concat` - Sequentially chains streams

**Grouping & Partitioning:**
- `Stream.groupByKey` - Groups by key function
- `Stream.partition` - Splits into matching/non-matching streams
- `Stream.intersperse` - Inserts separator between elements

#### Consumption

`Stream.runCollect` aggregates all elements into a chunk, commonly used with `Effect.runPromise` for execution.

---

## State Management with Ref

### What is Ref?

Effect's `Ref` is a mutable reference data type that enables safe state management in concurrent programs. `Ref` "represents a mutable reference" and provides "a controlled way to handle mutable state and safely update it in a concurrent environment."

The key distinction is that `Ref` operations are entirely effectful—all reads, writes, and updates return `Effect` values rather than raw results.

### Creating References

Create a `Ref` using `Ref.make(initialValue)`:

```typescript
const counterRef = Ref.make(0) // Effect.Effect<Ref.Ref<number>>
```

This returns an effect that must be executed to produce the actual reference.

### Core Operations

#### Reading State

Use `Ref.get(ref)` to retrieve the current value:
```typescript
const value = yield* Ref.get(counterRef)
```

#### Writing State

Use `Ref.set(ref, newValue)` to replace the value:
```typescript
yield* Ref.set(counterRef, 5)
```

#### Updating State

Use `Ref.update(ref, transformFunction)` to atomically modify the value:
```typescript
yield* Ref.update(counterRef, (n) => n + 1)
```

### Practical Patterns

#### Basic State Management

The documentation demonstrates a `Counter` class wrapping a `Ref<number>`:

```typescript
class Counter {
  inc = Ref.update(this.value, (n) => n + 1)
  dec = Ref.update(this.value, (n) => n - 1)
  get = Ref.get(this.value)
}
```

#### Concurrent Updates

Multiple fibers can safely access and modify shared state through a single `Ref` instance, as demonstrated with concurrent counter increments using `Effect.zip(..., { concurrent: true })`.

#### Service-Based State

Provide `Ref` as a service using `Effect.provideServiceEffect`, enabling different program components to access shared state through dependency injection.

All `Ref` operations maintain atomicity in concurrent contexts, preventing race conditions during simultaneous access.

---

## Sources

- [Introduction | Effect Documentation](https://effect.website/docs/getting-started/introduction/)
- [The Effect Type | Effect Documentation](https://effect.website/docs/getting-started/the-effect-type/)
- [Creating Effects | Effect Documentation](https://effect.website/docs/getting-started/creating-effects/)
- [Running Effects | Effect Documentation](https://effect.website/docs/getting-started/running-effects)
- [Using Generators | Effect Documentation](https://effect.website/docs/getting-started/using-generators)
- [Two Error Types | Effect Documentation](https://effect.website/docs/error-management/two-error-types/)
- [Expected Errors | Effect Documentation](https://effect.website/docs/error-management/expected-errors)
- [Services | Effect Documentation](https://effect.website/docs/requirements-management/services)
- [Layers | Effect Documentation](https://effect.website/docs/requirements-management/layers)
- [Fibers | Effect Documentation](https://effect.website/docs/concurrency/fibers)
- [Basic Concurrency | Effect Documentation](https://effect.website/docs/concurrency/basic-concurrency/)
- [Resource Management | Effect Documentation](https://effect.website/docs/resource-management/introduction/)
- [Scope | Effect Documentation](https://effect.website/docs/resource-management/scope/)
- [Introduction to Streams | Effect Documentation](https://effect.website/docs/stream/introduction/)
- [Creating Streams | Effect Documentation](https://effect.website/docs/stream/creating/)
- [Stream Operations | Effect Documentation](https://effect.website/docs/stream/operations/)
- [Ref | Effect Documentation](https://effect.website/docs/state-management/ref/)
