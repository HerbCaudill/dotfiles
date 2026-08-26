import type { JsonSchema } from "./types.ts"

/** Validate a value against the strict JSON Schema subset used by classifier contracts. */
export function validateJsonSchema(
  /** Value to validate. */
  value: unknown,
  /** Root schema containing any local definitions. */
  schema: JsonSchema,
): void {
  validateSchemaNode(value, schema, schema, "$")
}

/** Validate one recursive schema node. */
function validateSchemaNode(
  /** Value at the current path. */
  value: unknown,
  /** Schema at the current path. */
  schema: JsonSchema,
  /** Root schema used to resolve local references. */
  rootSchema: JsonSchema,
  /** Human-readable JSON path. */
  path: string,
): void {
  if (Array.isArray(schema.anyOf)) {
    validateAnyOf(value, schema.anyOf, rootSchema, path)
    return
  }

  const reference = schema.$ref
  if (typeof reference === "string") {
    validateSchemaNode(value, resolveReference(reference, rootSchema), rootSchema, path)
    return
  }

  if ("const" in schema && value !== schema.const)
    fail(path, `must equal ${JSON.stringify(schema.const)}`)

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    fail(path, `must be one of ${schema.enum.map(String).join(", ")}`)
  }

  if (schema.type === "object") {
    validateObject(value, schema, rootSchema, path)
    return
  }

  if (schema.type === "array") {
    validateArray(value, schema, rootSchema, path)
    return
  }

  if (schema.type === "string") validateString(value, schema, path)
  if (schema.type === "boolean" && typeof value !== "boolean") fail(path, "must be a boolean")
}

/** Accept a value when any alternative schema validates it. */
function validateAnyOf(
  /** Value at the current path. */
  value: unknown,
  /** Alternative schema nodes. */
  alternatives: unknown[],
  /** Root schema used to resolve local references. */
  rootSchema: JsonSchema,
  /** Human-readable JSON path. */
  path: string,
): void {
  let firstError: unknown
  for (const alternative of alternatives) {
    if (!isRecord(alternative)) continue
    try {
      validateSchemaNode(value, alternative, rootSchema, path)
      return
    } catch (error) {
      firstError ??= error
    }
  }

  if (firstError instanceof Error) throw firstError
  fail(path, "must match one permitted schema")
}

/** Validate an object schema node. */
function validateObject(
  /** Value at the current path. */
  value: unknown,
  /** Object schema. */
  schema: JsonSchema,
  /** Root schema used to resolve local references. */
  rootSchema: JsonSchema,
  /** Human-readable JSON path. */
  path: string,
): void {
  if (!isRecord(value)) fail(path, "must be an object")

  const properties = isRecord(schema.properties) ? schema.properties : {}
  const required = Array.isArray(schema.required) ? schema.required : []

  for (const property of required) {
    if (typeof property === "string" && !(property in value))
      fail(`${path}.${property}`, "is required")
  }

  for (const [key, propertyValue] of Object.entries(value)) {
    const propertySchema = properties[key]
    if (!isRecord(propertySchema)) {
      if (schema.additionalProperties === false) fail(`${path}.${key}`, "is not allowed")
      continue
    }

    validateSchemaNode(propertyValue, propertySchema, rootSchema, `${path}.${key}`)
  }
}

/** Validate an array schema node. */
function validateArray(
  /** Value at the current path. */
  value: unknown,
  /** Array schema. */
  schema: JsonSchema,
  /** Root schema used to resolve local references. */
  rootSchema: JsonSchema,
  /** Human-readable JSON path. */
  path: string,
): void {
  if (!Array.isArray(value)) fail(path, "must be an array")
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
    fail(path, `must contain at most ${schema.maxItems} items`)
  }

  if (!isRecord(schema.items)) return
  value.forEach((item, index) =>
    validateSchemaNode(item, schema.items as JsonSchema, rootSchema, `${path}[${index}]`),
  )
}

/** Validate a string schema node. */
function validateString(
  /** Value at the current path. */
  value: unknown,
  /** String schema. */
  schema: JsonSchema,
  /** Human-readable JSON path. */
  path: string,
): void {
  if (typeof value !== "string") fail(path, "must be a string")
  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    fail(path, `must contain at least ${schema.minLength} characters`)
  }
  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
    fail(path, `must contain at most ${schema.maxLength} characters`)
  }
}

/** Resolve a supported local JSON Schema reference. */
function resolveReference(
  /** Local reference. */
  reference: string,
  /** Root schema containing definitions. */
  rootSchema: JsonSchema,
): JsonSchema {
  const prefix = "#/$defs/"
  if (!reference.startsWith(prefix))
    throw new Error(`Unsupported JSON Schema reference: ${reference}`)

  const definitions = rootSchema.$defs
  const definition = isRecord(definitions) ? definitions[reference.slice(prefix.length)] : undefined
  if (!isRecord(definition)) throw new Error(`Unknown JSON Schema reference: ${reference}`)
  return definition
}

/** Report one contract violation. */
function fail(
  /** Human-readable JSON path. */
  path: string,
  /** Validation failure. */
  message: string,
): never {
  throw new Error(`${path} ${message}`)
}

/** Check whether a value is a plain JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
