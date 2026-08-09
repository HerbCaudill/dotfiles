import { describe, expect, test } from "vitest"
import { toVscodeFileUrl } from "../toVscodeFileUrl.ts"

describe("toVscodeFileUrl", () => {
  test("encodes reserved characters in filesystem paths", () => {
    expect(toVscodeFileUrl("/tmp/repository", "src/a # b?.ts", 7)).toBe(
      "vscode://file//tmp/repository/src/a%20%23%20b%3F.ts:7",
    )
  })
})
