import { describe, expect, test, vi } from "vitest"

import { runPersonalInfoSync } from "../runPersonalInfoSync.ts"

describe("runPersonalInfoSync", () => {
  test("runs the requested synchronization direction", () => {
    const sync = vi.fn()

    runPersonalInfoSync(["pull"], sync)

    expect(sync).toHaveBeenCalledWith("pull")
  })

  test("rejects an ambiguous or missing direction", () => {
    expect(() => runPersonalInfoSync([], vi.fn())).toThrow("Usage: personal-info-sync <pull|push>")
  })
})
