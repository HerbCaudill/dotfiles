import { describe, expect, test } from "vitest"

import { getDailyNoteDates } from "../getDailyNoteDates.ts"

describe("getDailyNoteDates", () => {
  test("returns note dates from tomorrow back through the previous 30 days", () => {
    const result = getDailyNoteDates(new Date("2026-04-20T12:00:00"))

    expect(result).toHaveLength(32)
    expect(result[0]).toBe("2026-04-21")
    expect(result[1]).toBe("2026-04-20")
    expect(result.at(-1)).toBe("2026-03-21")
  })
})
