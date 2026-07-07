import { describe, expect, test } from "vitest"

import { getWipBranch } from "../getWipBranch.ts"

describe("getWipBranch", () => {
  test("maps Herb feature branches to their WIP branch", () => {
    expect(getWipBranch("herb/some-feature")).toBe("herb/wip/some-feature")
  })

  test("keeps existing WIP branches unchanged", () => {
    expect(getWipBranch("herb/wip/some-feature")).toBe("herb/wip/some-feature")
  })

  test("keeps the namespace prefix for nested branches", () => {
    expect(getWipBranch("herb/report/templates/ui-tweaks")).toBe(
      "herb/wip/report/templates/ui-tweaks",
    )
  })
})
