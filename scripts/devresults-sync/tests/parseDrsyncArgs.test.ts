import { describe, expect, test } from "vitest"

import { parseDrsyncArgs } from "../parseDrsyncArgs.ts"

describe("parseDrsyncArgs", () => {
  test("recognizes background mode", () => {
    expect(parseDrsyncArgs(["--background", "git", "status"]).mode).toBe("background")
  })

  test("recognizes worker mode", () => {
    expect(parseDrsyncArgs(["--worker", "git", "status"]).mode).toBe("worker")
  })

  test("defaults to foreground mode", () => {
    expect(parseDrsyncArgs(["git", "status"])).toEqual({
      args: ["git", "status"],
      mode: "foreground",
    })
  })
})
