---
name: effect-schema
description: Reference for Effect Schema — type-safe data validation, parsing, transformation, and encoding/decoding in TypeScript.
---

# Effect Schema Reference

## The Schema Type

```typescript
Schema<Type, Encoded, Requirements>
```

- **Type (A)**: The decoded output type
- **Encoded (I)**: The input/encoded type (defaults to Type)
- **Requirements (R)**: Contextual dependencies (defaults to `never`)

## Setup

```typescript
import { Schema } from "effect"
```

Requires TypeScript 5.4+ with `strict: true`. Optionally enable `exactOptionalPropertyTypes: true`.

## Primitives

```typescript
Schema.String
Schema.Number
Schema.Boolean
Schema.BigIntFromSelf
Schema.SymbolFromSelf
Schema.Object
Schema.Undefined
Schema.Void
Schema.Any
Schema.Unknown
Schema.Never
```

## Defining Schemas

### Structs

```typescript
const Person = Schema.Struct({
  name: Schema.String,
  age: Schema.Number
})
```

### Type Extraction

```typescript
// Utility types
type PersonType = Schema.Type<typeof Person>
type PersonEncoded = Schema.Encoded<typeof Person>

// Interface style (better perf and readability)
interface Person extends Schema.Type<typeof Person> {}
```

Schemas produce **readonly types** by default.

### Literals and Unions

```typescript
const Status = Schema.Literal("active", "inactive", "pending")
const Flexible = Schema.Union(Schema.String, Schema.Number)
```

Union members are evaluated in definition order. Discriminated unions (tagged by a literal field) report errors only for the matching member.

### Optional Fields

```typescript
const Product = Schema.Struct({
  name: Schema.String,
  quantity: Schema.optional(Schema.Number)
})
// Type: { readonly name: string; readonly quantity?: number | undefined }

// Optional with a default
const WithDefault = Schema.Struct({
  name: Schema.String,
  role: Schema.optional(Schema.String).pipe(Schema.withDefault(() => "user"))
})
```

### Tuples

```typescript
const Pair = Schema.Tuple(Schema.String, Schema.Number)
// readonly [string, number]

// With rest elements
Schema.Tuple(Schema.String).pipe(Schema.rest(Schema.Number))
// readonly [string, ...number[]]
```

### Arrays and Records

```typescript
Schema.Array(Schema.String)        // readonly string[]
Schema.NonEmptyArray(Schema.Number) // readonly [number, ...number[]]

Schema.Record({
  key: Schema.String,
  value: Schema.Number
})
// { readonly [x: string]: number }
```

## Decoding and Encoding

### Decoding (parse external data)

```typescript
// Throws on error
Schema.decodeUnknownSync(schema)(input)

// Returns Either<A, ParseError>
Schema.decodeUnknownEither(schema)(input)

// Returns Effect<A, ParseError>
await Schema.decodeUnknown(schema)(input)
```

### Encoding (serialize to external format)

```typescript
Schema.encodeSync(schema)(value)
Schema.encodeEither(schema)(value)
await Schema.encode(schema)(value)
```

### Parse Options

```typescript
Schema.decodeUnknownEither(schema, {
  errors: "all",           // collect all errors (default: "first")
  onExcessProperty: "error" // reject extra properties (default: "ignore")
})(input)
```

## Transformations

### Guaranteed-success transform

```typescript
const StringToNumber = Schema.transform(
  Schema.String,  // from
  Schema.Number,  // to
  {
    decode: (s) => parseFloat(s),
    encode: (n) => String(n)
  }
)
```

### Fallible transform

```typescript
import { ParseResult } from "effect"

const SafeStringToNumber = Schema.transformOrFail(
  Schema.String,
  Schema.Number,
  {
    decode: (s) => {
      const n = parseFloat(s)
      return isNaN(n)
        ? ParseResult.fail(new ParseResult.Type(Schema.Number.ast, s))
        : ParseResult.succeed(n)
    },
    encode: (n) => ParseResult.succeed(String(n))
  }
)
```

### Built-in Transforms

**String**: `trim`, `lowercase`, `uppercase`, `capitalize`, `split`, `parseJson`

**Number**: `NumberFromString`, `clamp`

**Type conversions**: `BigInt`, `BigIntFromNumber`, `Date`, `BigDecimal`

**Base encoding**: `Base64`, `Base64Url`, `Hex`

## Filters and Refinements

### Custom Filters

```typescript
const LongString = Schema.String.pipe(
  Schema.filter((s) =>
    s.length >= 10 || "must be at least 10 characters"
  )
)
```

Return values from filter predicates:

| Return | Behavior |
|--------|----------|
| `true` / `undefined` | Passes |
| `false` | Fails (generic message) |
| `string` | Fails with that message |
| `ParseResult.ParseIssue` | Detailed error |
| `FilterIssue` | Error with path info |
| `Array<FilterIssue>` | Multiple errors |

### Filter with Annotations

```typescript
const LongString = Schema.String.pipe(
  Schema.filter(
    (s) => s.length >= 10 || "must be at least 10 characters",
    {
      identifier: "LongString",
      jsonSchema: { minLength: 10 },
      description: "A string at least 10 characters long"
    }
  )
)
```

### Error Path for Structs

```typescript
const PasswordForm = Schema.Struct({
  password: Schema.String,
  confirm: Schema.String
}).pipe(
  Schema.filter((input) => {
    if (input.password !== input.confirm) {
      return { path: ["confirm"], message: "Passwords do not match" }
    }
  })
)
```

### Built-in Filters

**String**: `maxLength(n)`, `minLength(n)`, `nonEmptyString()`, `length(n)`, `length({ min, max })`, `pattern(regex)`, `startsWith(s)`, `endsWith(s)`, `includes(s)`, `trimmed()`, `lowercased()`, `uppercased()`

**Number**: `greaterThan(n)`, `greaterThanOrEqualTo(n)`, `lessThan(n)`, `lessThanOrEqualTo(n)`, `between(min, max)`, `int()`, `nonNaN()`, `finite()`, `positive()`, `nonNegative()`, `negative()`, `nonPositive()`, `multipleOf(n)`

**Number shorthands**: `Schema.Int`, `Schema.Positive`, `Schema.NonNegative`, `Schema.Uint8`

**Array**: `maxItems(n)`, `minItems(n)`, `itemsCount(n)`

**Date**: `validDate()`, `greaterThanDate(d)`, `lessThanDate(d)`, `betweenDate(min, max)`

**BigInt**: `greaterThanBigInt(n)`, `lessThanBigInt(n)`, `betweenBigInt(min, max)`, `positiveBigInt()`, `nonNegativeBigInt()`

## Classes

```typescript
class Person extends Schema.Class<Person>("Person")({
  id: Schema.Number,
  name: Schema.NonEmptyString
}) {
  get upperName() {
    return this.name.toUpperCase()
  }
}

// Constructor validates automatically
const p = new Person({ id: 1, name: "Alice" })
p.upperName // "ALICE"

new Person({ id: 1, name: "" }) // throws ParseError
```

Classes automatically implement `Equal` and `Hash` traits for value-based equality.

### Extending Classes

```typescript
class Employee extends Schema.Class<Employee>("Employee")({
  ...Person.fields,
  department: Schema.String
}) {}
```

## Brands

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = Schema.Type<typeof UserId>
// string & Brand<"UserId">

// Create branded value (validates)
const id = UserId.make("abc123")

// Using with existing branded types
type Email = string & Brand.Brand<"Email">
const Email = Brand.nominal<Email>()
const EmailSchema = Schema.String.pipe(
  Schema.pattern(/^[^@]+@[^@]+$/),
  Schema.fromBrand(Email)
)
```

## Property Signatures

### Rename Fields (fromKey)

```typescript
const User = Schema.Struct({
  name: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey("user_name")
  )
})
// Decodes { user_name: "Alice" } → { name: "Alice" }
// Encodes { name: "Alice" } → { user_name: "Alice" }
```

### Rename on Existing Schemas

```typescript
const Renamed = Original.pipe(Schema.rename({ oldKey: "newKey" }))
```

## Extending Schemas

```typescript
// Spread fields
const Extended = Schema.Struct({
  ...Base.fields,
  extra: Schema.String
})

// extend function
const Extended = Base.pipe(
  Schema.extend(Schema.Struct({ extra: Schema.String }))
)
```

## Recursive Schemas

```typescript
interface Category {
  readonly name: string
  readonly children: ReadonlyArray<Category>
}

const Category: Schema.Schema<Category> = Schema.suspend(() =>
  Schema.Struct({
    name: Schema.String,
    children: Schema.Array(Category)
  })
)
```

## Error Formatting

### TreeFormatter (default)

```typescript
import { ParseResult } from "effect"

const result = Schema.decodeUnknownEither(Person)({})
if (Either.isLeft(result)) {
  console.log(ParseResult.TreeFormatter.formatErrorSync(result.left))
}
// Person
// └─ ["name"]
//    └─ is missing
```

### ArrayFormatter

```typescript
ParseResult.ArrayFormatter.formatErrorSync(error)
// [
//   { _tag: "Missing", path: ["name"], message: "is missing" },
//   { _tag: "Missing", path: ["age"], message: "is missing" }
// ]
```

### Custom Error Messages

```typescript
const Name = Schema.String.pipe(
  Schema.nonEmptyString({ message: () => "Name is required" })
)
```

## Annotations

```typescript
const User = Schema.Struct({
  email: Schema.String.annotations({
    identifier: "Email",
    title: "Email address",
    description: "A valid email address",
    examples: ["user@example.com"],
    message: () => "Please enter a valid email"
  })
})
```

Key annotations: `identifier`, `title`, `description`, `documentation`, `examples`, `message`, `default`, `jsonSchema`, `arbitrary`, `decodingFallback`.

### Concurrency Annotation

For schemas validating arrays/structs, control parallel validation:

```typescript
Schema.Array(Schema.String).annotations({ concurrency: "unbounded" })
```

### Decoding Fallback

```typescript
Schema.String.annotations({
  decodingFallback: () => Effect.succeed("default")
})
```

## Effect Data Types

```typescript
// Option
Schema.Option(Schema.String)
// Decodes { _tag: "None" } | { _tag: "Some", value: string }

Schema.OptionFromNullOr(Schema.String)
// Decodes null → Option.none(), string → Option.some(string)

Schema.OptionFromUndefinedOr(Schema.String)

// Either
Schema.Either({ left: Schema.String, right: Schema.Number })
// Decodes { _tag: "Left", left: string } | { _tag: "Right", right: number }

// ReadonlySet and ReadonlyMap
Schema.ReadonlySet(Schema.Number)   // Array ↔ ReadonlySet
Schema.ReadonlyMap({
  key: Schema.String,
  value: Schema.Number
})

// Duration
Schema.Duration                     // Encodes as millis
Schema.DurationFromMillis           // number → Duration
Schema.DurationFromNanos            // bigint → Duration

// Data (value equality)
Schema.Data(Schema.Struct({ name: Schema.String }))
```

## JSON Schema Generation

```typescript
import { JSONSchema } from "effect"

const jsonSchema = JSONSchema.make(Person)
```

Traverses from innermost component outward. **Stops at the first transformation** — refinements before transforms are preserved, but downstream transforms are not represented in output.

## Arbitrary (Test Data Generation)

```typescript
import { Arbitrary } from "effect"
import * as fc from "fast-check"

const arb = Arbitrary.make(Person)
fc.sample(arb, 5) // 5 random Person values

// Custom arbitrary via annotation
const Name = Schema.NonEmptyString.annotations({
  arbitrary: () => (fc) => fc.constantFrom("Alice", "Bob", "Charlie")
})
```

Use `Schema.pattern(regex)` over custom filters for string patterns — it leverages `fc.stringMatching(regexp)` for better generation.

## Common Patterns

### API Response Validation

```typescript
const ApiResponse = Schema.Struct({
  data: Schema.Array(User),
  total: Schema.Number,
  page: Schema.Number
})

const parse = Schema.decodeUnknownSync(ApiResponse)

const response = parse(await fetch("/api/users").then(r => r.json()))
```

### Form Validation (React Hook Form)

```typescript
// @hookform/resolvers has an Effect Schema adapter
const FormData = Schema.Struct({
  email: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "Email is required" }),
    Schema.pattern(/^[^@]+@[^@]+$/, { message: () => "Invalid email" })
  ),
  password: Schema.String.pipe(
    Schema.minLength(8, { message: () => "At least 8 characters" })
  )
})
```

### Encoding/Decoding Roundtrip

The golden rule: `encode(decode(input))` should produce the original `input`.

```typescript
const DateFromString = Schema.Date
// Decodes: string → Date
// Encodes: Date → string

const decoded = Schema.decodeUnknownSync(DateFromString)("2024-01-01T00:00:00Z")
// Date object

const encoded = Schema.encodeSync(DateFromString)(decoded)
// "2024-01-01T00:00:00.000Z"
```

### Declaring Custom Types

```typescript
const FileFromSelf = Schema.declare(
  (input: unknown): input is File => input instanceof File,
  { identifier: "FileFromSelf", description: "A browser File object" }
)
```

## Key Principles

- **Schemas are immutable values**: Every operation returns a new schema
- **Schemas are blueprints**: They describe structure; compilers interpret them
- **Bidirectional**: Every schema supports both decoding and encoding
- **Composable**: Build complex schemas from simple ones
- **Encoded ≠ Type**: The wire format can differ from the in-memory type
- **Validate at boundaries**: Decode external data at system edges
