import { describe, expect, it } from "vitest"

import { amdReleaseCandidates } from "../amdReleaseCandidates.ts"

describe("amdReleaseCandidates", () => {
  it("lists later releases in the same month and the next two months, oldest first", () => {
    expect(amdReleaseCandidates("26.10.2")).toEqual([
      "26.10.3",
      "26.10.4",
      "26.11.1",
      "26.11.2",
      "26.11.3",
      "26.12.1",
      "26.12.2",
    ])
  })

  it("rolls over into the next year", () => {
    expect(amdReleaseCandidates("26.12.1")).toEqual([
      "26.12.2",
      "26.12.3",
      "27.1.1",
      "27.1.2",
      "27.1.3",
      "27.2.1",
      "27.2.2",
    ])
  })
})
