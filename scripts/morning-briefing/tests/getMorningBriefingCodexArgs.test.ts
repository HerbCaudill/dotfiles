import { describe, expect, test } from "vitest"

import { getMorningBriefingCodexArgs } from "../runMorningBriefing.ts"

describe("getMorningBriefingCodexArgs", () => {
  test("builds an unattended ephemeral run using the briefing model and repository", () => {
    const args = getMorningBriefingCodexArgs()

    expect(args).toContain("--ephemeral")
    expect(args).toContain("gpt-5.6-sol")
    expect(args).toContain('model_reasoning_effort="medium"')
    expect(args).toContain("danger-full-access")
    expect(args).toContain("never")
    expect(args).toContain("/Users/herbcaudill/Code/HerbCaudill/briefings")
    expect(args.at(-1)).toContain("morning-briefing skill")
  })
})
