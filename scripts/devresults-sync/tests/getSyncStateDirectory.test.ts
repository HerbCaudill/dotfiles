import { describe, expect, test } from "vitest"

import { getSyncStateDirectory } from "../getSyncStateDirectory.ts"

describe("getSyncStateDirectory", () => {
  test("creates a stable state directory key from a repository path", () => {
    expect(getSyncStateDirectory("/Users/herb/Code/DevResults")).toContain(
      "drsync-Users-herb-Code-DevResults",
    )
  })

  test("uses the XDG state home when available", () => {
    expect(
      getSyncStateDirectory("/Users/herb/Code/DevResults", {
        HOME: "/Users/herb",
        XDG_STATE_HOME: "/tmp/state",
      }),
    ).toBe("/tmp/state/drsync/drsync-Users-herb-Code-DevResults")
  })
})
