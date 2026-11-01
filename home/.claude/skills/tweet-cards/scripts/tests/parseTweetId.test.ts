import { expect, test } from "vitest"

import { parseTweetId } from "../parseTweetId.ts"

test("reads an ID from a bare ID or a tweet URL", () => {
  expect(parseTweetId("2116552016218710389")).toBe("2116552016218710389")
  expect(parseTweetId("https://x.com/steveruizok/status/20?s=20")).toBe("20")
  expect(parseTweetId("https://twitter.com/jack/status/20/photo/1")).toBe("20")
})

test("rejects anything else", () => {
  expect(() => parseTweetId("https://x.com/jack")).toThrow("Not a tweet ID or URL")
})
