import { describe, expect, test } from "vitest"

import {
  getMorningBriefingAppServerEnvironment,
  getMorningBriefingInitializeRequest,
  getMorningBriefingThreadName,
  getMorningBriefingThreadStartRequest,
  getMorningBriefingTurnStartRequest,
} from "../runMorningBriefing.ts"

describe("morning briefing App Server requests", () => {
  test("creates a named unattended thread that the Codex sidebar includes", () => {
    const threadId = "thread-123"
    const now = new Date("2026-08-28T10:00:00Z")

    expect(getMorningBriefingAppServerEnvironment({ PATH: "/bin" })).toEqual({
      CODEX_INTERNAL_ORIGINATOR_OVERRIDE: "Codex Desktop",
      PATH: "/bin",
    })
    expect(getMorningBriefingInitializeRequest()).toMatchObject({
      method: "initialize",
      params: { clientInfo: { name: "codex_cli_rs" } },
    })
    expect(getMorningBriefingThreadName(now)).toBe("Morning briefing – August 28, 2026")
    expect(getMorningBriefingThreadStartRequest()).toMatchObject({
      method: "thread/start",
      params: {
        approvalPolicy: "never",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/briefings",
        ephemeral: false,
        model: "gpt-5.6-sol",
        sandbox: "danger-full-access",
        threadSource: "morning-briefing",
      },
    })
    expect(getMorningBriefingTurnStartRequest(threadId)).toMatchObject({
      method: "turn/start",
      params: {
        approvalPolicy: "never",
        effort: "medium",
        sandboxPolicy: { type: "dangerFullAccess" },
        threadId,
      },
    })
    expect(getMorningBriefingTurnStartRequest(threadId).params.input[0]).toMatchObject({
      text: expect.stringContaining("morning-briefing skill"),
    })
  })
})
