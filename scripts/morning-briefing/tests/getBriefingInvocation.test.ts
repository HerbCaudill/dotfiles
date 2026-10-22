import { expect, test } from "vitest"
import { getBriefingInvocation } from "../getBriefingInvocation.ts"

test("the trusted launcher can export Mac sources without starting a briefing", () => {
  expect(getBriefingInvocation(["--mac-sources", "--export-only"])).toEqual({
    entrypoint: "/Users/herbcaudill/Code/HerbCaudill/briefings/scripts/mac-sources/run.ts",
    arguments: ["--export-only"],
  })
})
