import { describe, expect, test, vi } from "vitest"

import { runPersonalInfoSync } from "../runPersonalInfoSync.ts"

describe("runPersonalInfoSync", () => {
  test("runs the requested synchronization direction", () => {
    const sync = vi.fn()

    const mirror = vi.fn()
    runPersonalInfoSync(["pull"], sync, mirror)

    expect(sync).toHaveBeenCalledWith("pull")
    expect(mirror).toHaveBeenCalledOnce()
    expect(sync.mock.invocationCallOrder[0]).toBeLessThan(mirror.mock.invocationCallOrder[0]!)
  })

  test("rejects an ambiguous or missing direction", () => {
    expect(() => runPersonalInfoSync([], vi.fn())).toThrow(
      "Usage: personal-info-sync <pull|push|mini>",
    )
  })

  test("mini copies the local files without accessing 1Password", () => {
    const sync = vi.fn()
    const mirror = vi.fn()
    runPersonalInfoSync(["mini"], sync, mirror)
    expect(sync).not.toHaveBeenCalled()
    expect(mirror).toHaveBeenCalledOnce()
  })
})
