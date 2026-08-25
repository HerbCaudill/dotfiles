---
name: effect-schema
description: Use when working with Effect Schema — type-safe data validation, parsing, transformation, and encoding/decoding in TypeScript.
---

# Effect Schema Reference (Effect v4)

This covers the Effect v4 API (verified against `effect@4.0.0-rc.111`). v4 renamed much of the v3 surface; the table at the end maps old names to new ones. If a project pins `effect@3.x`, the v3 names still apply there.

## The Codec type

```typescript
Schema.Codec<Type, Encoded = Type, DecodingServices = never, EncodingServices = never>
```

- **Type**: the decoded, in-memory type
- **Encoded**: the wire/input type
- **DecodingServices / EncodingServices**: Effect services each direction needs (usually `never`)

`Schema.Schema<T>` is the type-only view (no encoded side). Most function signatures accept `Schema.Constraint` – use it as the generic bound when writing helpers that take any schema:

```typescript
function nullable<const S extends Schema.Constraint>(schema: S) { ... }
```

There is no `Schema.Schema.AnyNoContext`. For "any bidirectional codec with no services" write `Schema.Codec<unknown, unknown, never, never>`.

## Setup

```typescript
import { Schema, SchemaGetter, Result } from "effect"
```

## Primitives

`Schema.String`, `Number`, `Finite`, `Int`, `Boolean`, `BigInt`, `Symbol`, `Undefined`, `Null`, `Void`, `Any`, `Unknown`, `Never`, `NonEmptyString`, `Trim` (trims on decode), `Json`, `Date`, `URL`, `Uint8Array`.

## Defining schemas

### Structs

```typescript
const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
})

type Person = typeof Person.Type
type PersonEncoded = typeof Person.Encoded
```

Types come off the schema as `.Type` and `.Encoded` properties. Struct types are readonly.

Give the schema and its type the same name (`const Person` / `type Person`), as above. Do not add a `Schema` suffix to the const or an `I`/`Type` prefix to the type; TypeScript keeps values and types in separate namespaces, so one name serves both.

`Person.fields` exposes the field map; `Person.mapFields(f)` derives a new struct; `Schema.fieldsAssign({ extra })` adds fields (works across union members with `mapMembers`).

### Literals, unions, enums

```typescript
Schema.Literal("active")
Schema.Literals(["active", "inactive", "pending"])
Schema.Union([Schema.String, Schema.Number]) // note the array
Schema.Union([A, B], { mode: "oneOf" }) // exactly one member must match
Schema.Enum(MyEnum)
Schema.TaggedStruct("Circle", { radius: Schema.Number })
Schema.TaggedUnion({ Circle: { radius: Schema.Number }, Square: { side: Schema.Number } })
```

### Optional and nullable fields

```typescript
Schema.optionalKey(Schema.Number) // key may be absent: { age?: number }
Schema.optional(Schema.Number) // absent or undefined: { age?: number | undefined }
Schema.NullOr(Schema.Number) // number | null
Schema.UndefinedOr(Schema.Number)
Schema.NullishOr(Schema.Number)
```

`optional` is `optionalKey(UndefinedOr(S))`. Prefer `optionalKey` for exact-optional semantics.

Defaults take an `Effect`:

```typescript
// Default during decoding, expressed in Encoded terms
Schema.String.pipe(Schema.optional, Schema.withDecodingDefault(Effect.succeed("anonymous")))

// Default during `make`, not during decoding
Schema.String.pipe(Schema.optionalKey, Schema.withConstructorDefault(Effect.succeed("anonymous")))
```

### Tuples, arrays, records

```typescript
Schema.Tuple([Schema.String, Schema.Number]) // readonly [string, number]
Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])
Schema.Array(Schema.String)
Schema.NonEmptyArray(Schema.Number)
Schema.UniqueArray(Schema.String)
Schema.Record(Schema.String, Schema.Number) // positional args, not { key, value }
Schema.StructWithRest(Schema.Struct({ id: Schema.Number }), [
  Schema.Record(Schema.String, Schema.Unknown),
])
```

## Decoding and encoding

```typescript
Schema.decodeUnknownSync(schema)(input) // throws SchemaError
Schema.decodeUnknownResult(schema)(input) // Result<A, SchemaError>
Schema.decodeUnknownEffect(schema)(input) // Effect<A, SchemaError, R>
Schema.decodeUnknownPromise(schema)(input)
Schema.decodeUnknownOption(schema)(input)
Schema.decodeUnknownExit(schema)(input)

Schema.encodeSync(schema)(value)
Schema.encodeUnknownResult(schema)(value)
Schema.encodeEffect(schema)(value)
```

The `decode*`/`encode*` variants (without `Unknown`) take a typed input. `Schema.is(schema)(u)` is a type guard; `Schema.asserts(schema, u)` asserts.

Handling a `Result`:

```typescript
const result = Schema.decodeUnknownResult(Person)(input)
if (Result.isFailure(result)) return result.failure // SchemaError
result.success // Person
```

Parse options are the second argument: `Schema.decodeUnknownResult(schema, { errors: "all", onExcessProperty: "error" })`.

### Errors

`Schema.SchemaError` has one field, `issue: SchemaIssue.Issue`, and a readable `message`. Issue tags: `InvalidType`, `InvalidValue`, `MissingKey`, `UnexpectedKey`, `Forbidden`, `Filter`, `Encoding`, `Pointer` (path wrapper), `Composite`, `AnyOf`, `OneOf`. `SchemaIssue.makeFormatterDefault()` builds a string formatter for issues. There is no `ParseResult` module and no `TreeFormatter`/`ArrayFormatter`.

## Transformations

Transformations attach a pair of **getters** (`SchemaGetter`) to `decodeTo` / `encodeTo`:

```typescript
import { Schema, SchemaGetter } from "effect"

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform(s => Number(s)),
    encode: SchemaGetter.transform(n => String(n)),
  }),
)
```

Getters: `transform(f)`, `transformOrFail(f => Effect<T, SchemaIssue.Issue>)`, `transformOptional(Option => Option)` (sees absence), `passthrough()`, `succeed(v)`, `fail(...)`, `omit()`, `withDefault(Effect)`, `required()`, plus string helpers (`trim`, `toLowerCase`, `parseJson`, `stringifyJson`, `split`, base64/hex codecs).

`Schema.decodeTo(to)` with no options composes two schemas whose types line up. `Schema.flip(schema)` swaps the directions. `Schema.toType(schema)` / `Schema.toEncoded(schema)` project a codec to one side only – useful when composing a wrapper around an existing codec:

```typescript
// Accept null or absence on the wire; decode to an absent key
const optionalNullable = <const S extends Schema.Constraint>(schema: S) =>
  Schema.optional(Schema.NullOr(Schema.toEncoded(schema))).pipe(
    Schema.decodeTo(Schema.optionalKey(schema), {
      decode: SchemaGetter.transformOptional(o => Option.filter(o, v => v != null)),
      encode: SchemaGetter.passthrough({ strict: false }),
    }),
  )
```

Built-in codecs: `NumberFromString`, `BigIntFromString`, `DateFromString`, `DateFromMillis`, `DateTimeUtcFromString`, `DurationFromMillis`, `StringFromBase64`, `Uint8ArrayFromHex`, `URLFromString`, `fromJsonString(schema)`.

### Renaming keys

```typescript
Person.pipe(Schema.encodeKeys({ name: "full_name" }))
// Decodes { full_name, age } → { name, age }; encodes back
```

### JSON serialization boundary

`Schema.toCodecJson(schema)` derives a codec whose Encoded side is guaranteed plain JSON. Use it at persistence boundaries (localStorage, IndexedDB) so values a looser schema admits (e.g. `bigint` under `Schema.Unknown`) are rejected instead of corrupting storage.

## Filters and refinements

Checks attach via `Schema.check(...)`; built-ins are prefixed `is*`:

```typescript
const Age = Schema.Finite.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(120)),
)
const Slug = Schema.String.pipe(Schema.check(Schema.isPattern(/^[a-z-]+$/), Schema.isMaxLength(40)))
```

**String**: `isMinLength`, `isMaxLength`, `isLengthBetween`, `isNonEmpty`, `isPattern`, `isStartsWith`, `isEndsWith`, `isIncludes`, `isTrimmed`, `isLowercased`, `isUppercased`, `isUUID`, `isULID`, `isGUID`, `isBase64`
**Number**: `isGreaterThan`, `isGreaterThanOrEqualTo`, `isLessThan`, `isLessThanOrEqualTo`, `isBetween({ minimum, maximum })`, `isInt`, `isInt32`, `isFinite`, `isMultipleOf`
**Collections**: `isMinSize`, `isMaxSize`, `isSizeBetween`, `isUnique`, `isMinProperties`, `isMaxProperties`
**Date / BigInt / BigDecimal**: `isGreaterThanDate`, `isBetweenBigInt`, etc.

Custom checks use `makeFilter`. The predicate returns `true`/`undefined` to pass, or `false`, a `string` message, a `SchemaIssue.Issue`, `{ path, issue }`, or an array of those:

```typescript
const PasswordForm = Schema.Struct({ password: Schema.String, confirm: Schema.String }).pipe(
  Schema.check(
    Schema.makeFilter(o =>
      o.password === o.confirm ? true : { path: ["confirm"], issue: "Passwords do not match" },
    ),
  ),
)
```

`Schema.refine(guard)` narrows the type with a type predicate. `Schema.String.pipe(Schema.check(Schema.isNonEmpty({ message: "Name is required" })))` sets a custom message.

## Classes

```typescript
class Person extends Schema.Class<Person>("Person")({
  id: Schema.Number,
  name: Schema.NonEmptyString,
}) {
  get upperName() {
    return this.name.toUpperCase()
  }
}

new Person({ id: 1, name: "Alice" }) // validates; throws on bad input

class Employee extends Person.extend<Employee>("Employee")({ department: Schema.String }) {}
```

The identifier is required and stable – it's used for diagnostics and survives HMR where `instanceof` fails. `Schema.TaggedClass` adds a `_tag`; `Schema.TaggedError` makes a yieldable error class.

## Brands

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type // string & Brand<"UserId">

// Reuse an existing Brand constructor's checks
Schema.String.pipe(Schema.fromBrand("Email", Email))
```

`brand` narrows the type only; put runtime checks in a `check` before it.

## Recursive schemas

```typescript
interface Tree {
  readonly value: number
  readonly children: ReadonlyArray<Tree>
}

const Tree = Schema.Struct({
  value: Schema.Number,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Tree> => Tree)),
})
```

## Annotations

```typescript
Schema.String.pipe(
  Schema.annotate({
    identifier: "Email",
    title: "Email address",
    description: "...",
    examples: ["a@b.c"],
  }),
)
```

`Schema.annotate` replaces the v3 `.annotations()` method. `annotateKey` targets a struct key (`messageMissingKey`, `messageUnexpectedKey`); `annotateEncoded` targets the encoded side.

## Declaring custom types

```typescript
const FileFromSelf = Schema.declare((u: unknown): u is File => u instanceof File, {
  identifier: "File",
})
```

## Effect data types

`Schema.Option(A)`, `OptionFromNullOr(A)`, `OptionFromUndefinedOr(A)`, `OptionFromOptionalKey(A)`, `Schema.Result(success, failure)` (replaces `Schema.Either`), `Schema.Exit`, `Schema.Cause`, `ReadonlySet(A)`, `ReadonlyMap(K, V)` (positional), `HashSet`, `HashMap`, `Chunk`, `Duration`, `DateTimeUtc`, `Redacted(A)`.

## Derived tooling

```typescript
Schema.toJsonSchemaDocument(schema) // draft 2020-12 document
Schema.toStandardSchemaV1(schema) // Standard Schema adapter (form libraries etc.)
Schema.toArbitrary(schema)(FastCheck) // fast-check arbitrary; memoized
Schema.toEquivalence(schema)
Schema.toFormatter(schema) // human-readable string formatter for values
```

## Common patterns

### API response at a boundary

```typescript
const ApiResponse = Schema.Struct({ data: Schema.Array(User), total: Schema.Number })
const parse = Schema.decodeUnknownSync(ApiResponse)
const response = parse(await fetch("/api/users").then(r => r.json()))
```

### Partial decoding of a collection (keep good items, collect failures)

```typescript
const entries = items.map(item => Schema.decodeUnknownResult(Item)(item))
const data = entries.filter(Result.isSuccess).map(e => e.success)
const causes = entries.filter(Result.isFailure).map(e => e.failure)
```

## v3 → v4 rename table

| v3                                        | v4                                                  |
| ----------------------------------------- | --------------------------------------------------- |
| `Schema.Schema<A, I, R>`                  | `Schema.Codec<A, I, RD, RE>`                        |
| `Schema.Schema.AnyNoContext`              | `Schema.Codec<unknown, unknown, never, never>`      |
| `Schema.Type<typeof S>` / `Encoded`       | `typeof S.Type` / `typeof S.Encoded`                |
| `decodeUnknown` (Effect)                  | `decodeUnknownEffect`                               |
| `decodeUnknownEither` / `encodeEither`    | `decodeUnknownResult` / `encodeUnknownResult`       |
| `Either.isLeft` / `.left` / `.right`      | `Result.isFailure` / `.failure` / `.success`        |
| `ParseResult.ParseError`                  | `Schema.SchemaError` (`.issue: SchemaIssue.Issue`)  |
| `ParseResult.TreeFormatter`               | `SchemaIssue.makeFormatterDefault()`                |
| `Schema.Record({ key, value })`           | `Schema.Record(key, value)`                         |
| `Schema.ReadonlyMap({ key, value })`      | `Schema.ReadonlyMap(key, value)`                    |
| `Schema.Union(A, B)` / `Tuple(A, B)`      | `Schema.Union([A, B])` / `Tuple([A, B])`            |
| `Schema.Literal("a", "b")`                | `Schema.Literals(["a", "b"])`                       |
| `transform` / `transformOrFail`           | `decodeTo(to, { decode, encode })` + `SchemaGetter` |
| `Schema.filter(pred)`                     | `Schema.check(Schema.makeFilter(pred))`             |
| `Schema.minLength(n)` etc.                | `Schema.check(Schema.isMinLength(n))` etc.          |
| `.annotations({...})`                     | `Schema.annotate({...})`                            |
| `propertySignature(S).pipe(fromKey(...))` | `Schema.encodeKeys({ decodedKey: "encodedKey" })`   |
| `Schema.withDefault(() => v)`             | `Schema.withDecodingDefault(Effect.succeed(v))`     |
| `Schema.Either({ left, right })`          | `Schema.Result(success, failure)`                   |
| `JSONSchema.make(S)`                      | `Schema.toJsonSchemaDocument(S)`                    |
| `Arbitrary.make(S)`                       | `Schema.toArbitrary(S)(FastCheck)`                  |
| `Schema.extend`                           | `Schema.fieldsAssign` / `Struct.mapFields`          |

## Key principles

- **Schemas are immutable values**: every combinator returns a new schema
- **Bidirectional**: every codec decodes and encodes; keep `encode(decode(x)) === x`
- **Encoded ≠ Type**: the wire format can differ from the in-memory type
- **Validate at boundaries**: decode external data at system edges; use `toCodecJson` at storage edges
