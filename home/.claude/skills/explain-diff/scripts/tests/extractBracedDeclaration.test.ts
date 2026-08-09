import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, test } from "vitest"

describe("extractBracedDeclaration", () => {
  test("returns a complete declaration without unrelated imports or trailing code", async () => {
    const moduleUrl = pathToFileURL(
      path.resolve(import.meta.dirname, "../extractBracedDeclaration.ts"),
    ).href
    const module = await import(moduleUrl)
    const source = `import path from "node:path"

/** Build the result. */
export function buildResult(input: string) {
  const nested = { input }
  return \`${"${nested.input}"}\`
}

export const unrelated = true
`

    expect(module.extractBracedDeclaration(source, "export function buildResult")).toEqual({
      line: 3,
      text: `/** Build the result. */
export function buildResult(input: string) {
  const nested = { input }
  return \`${"${nested.input}"}\`
}`,
    })
  })

  test("ignores braces in destructured parameters and type annotations", async () => {
    const moduleUrl = pathToFileURL(
      path.resolve(import.meta.dirname, "../extractBracedDeclaration.ts"),
    ).href
    const module = await import(moduleUrl)
    const source = `export function pick({ value }: { value: string }) {
  return value
}`

    expect(module.extractBracedDeclaration(source, "export function pick").text).toBe(source)
  })

  test("ignores closing braces in regular expression literals", async () => {
    const moduleUrl = pathToFileURL(
      path.resolve(import.meta.dirname, "../extractBracedDeclaration.ts"),
    ).href
    const module = await import(moduleUrl)
    const source = `export function matches(value: string) {
  return /}/.test(value)
}`

    expect(module.extractBracedDeclaration(source, "export function matches").text).toBe(source)
  })

  test("parses generic arrow functions as TypeScript rather than JSX", async () => {
    const moduleUrl = pathToFileURL(
      path.resolve(import.meta.dirname, "../extractBracedDeclaration.ts"),
    ).href
    const module = await import(moduleUrl)
    const declaration = `export const identity = <T>(value: T) => {
  return value
}`
    const source = `${declaration}

export const after = true`

    expect(
      module.extractBracedDeclaration(source, "export const identity", "identity.ts").text,
    ).toBe(declaration)
  })
})
