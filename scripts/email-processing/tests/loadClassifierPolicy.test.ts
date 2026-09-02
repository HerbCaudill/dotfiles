import { describe, expect, it } from "vitest"

import { loadClassifierPolicy } from "../loadClassifierPolicy.ts"

describe("loadClassifierPolicy", () => {
  it("returns the standalone prompt with a content-derived audit version", async () => {
    const policy = await loadClassifierPolicy()

    expect(policy.prompt).toContain("# Decision order")
    expect(policy.version).toMatch(/^sha256:[a-f0-9]{64}$/)
  })
})
