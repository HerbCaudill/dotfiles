import { describe, expect, test } from "vitest"

import {
  getMorningBriefingAppServerEnvironment,
  getMorningBriefingArchiveRequest,
  getMorningBriefingGoalSetRequest,
  getMorningBriefingInitializeRequest,
  getMorningBriefingPresentationThreadName,
  getMorningBriefingPresentationThreadStartRequest,
  getMorningBriefingPresentationTurnStartRequest,
  getMorningBriefingResearchThreadName,
  getMorningBriefingResearchThreadStartRequest,
  getMorningBriefingResearchTurnStartRequest,
  isMorningBriefingResearchReadyToArchive,
} from "../runMorningBriefing.ts"

describe("morning briefing App Server requests", () => {
  test("runs research under a persistent goal in a separately named thread", () => {
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
    expect(getMorningBriefingResearchThreadName(now)).toBe(
      "Morning briefing diagnostics – August 28, 2026",
    )
    expect(getMorningBriefingResearchThreadStartRequest()).toMatchObject({
      method: "thread/start",
      params: {
        approvalPolicy: "never",
        cwd: "/Users/herbcaudill/Code/HerbCaudill/briefings",
        ephemeral: false,
        model: "gpt-5.6-sol",
        sandbox: "danger-full-access",
      },
    })
    expect(getMorningBriefingGoalSetRequest(threadId)).toEqual({
      method: "thread/goal/set",
      id: 3,
      params: {
        threadId,
        objective: expect.stringContaining("saved to today's Obsidian daily note"),
        status: "active",
      },
    })
    expect(getMorningBriefingResearchTurnStartRequest(threadId)).toMatchObject({
      method: "turn/start",
      id: 4,
      params: {
        approvalPolicy: "never",
        effort: "medium",
        sandboxPolicy: { type: "dangerFullAccess" },
        threadId,
      },
    })
    expect(getMorningBriefingResearchTurnStartRequest(threadId).params.input[0]).toMatchObject({
      text: expect.stringContaining("morning-briefing skill"),
    })
    expect(getMorningBriefingArchiveRequest(threadId)).toEqual({
      method: "thread/archive",
      id: 5,
      params: { threadId },
    })
  })

  test("creates a clean presentation thread after research succeeds", () => {
    const threadId = "thread-456"
    const now = new Date("2026-08-28T10:00:00Z")

    expect(getMorningBriefingPresentationThreadName(now)).toBe("Morning briefing – August 28, 2026")
    expect(getMorningBriefingPresentationThreadStartRequest()).toMatchObject({
      method: "thread/start",
      id: 6,
      params: {
        ephemeral: false,
        threadSource: "morning-briefing",
      },
    })
    expect(getMorningBriefingPresentationTurnStartRequest(threadId).params).toMatchObject({
      threadId,
      input: [
        {
          type: "text",
          text: expect.stringContaining("Return only the `## Daily briefing` section"),
        },
      ],
    })
  })

  test("archives research only after the active goal and current turn both complete", () => {
    expect(
      isMorningBriefingResearchReadyToArchive({
        phase: "research",
        researchGoalComplete: true,
        researchTurnCompleted: false,
      }),
    ).toBe(false)
    expect(
      isMorningBriefingResearchReadyToArchive({
        phase: "research",
        researchGoalComplete: false,
        researchTurnCompleted: true,
      }),
    ).toBe(false)
    expect(
      isMorningBriefingResearchReadyToArchive({
        phase: "research",
        researchGoalComplete: true,
        researchTurnCompleted: true,
      }),
    ).toBe(true)
  })
})
