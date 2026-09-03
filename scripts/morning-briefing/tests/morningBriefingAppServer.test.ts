import { describe, expect, test } from "vitest"

import {
  getMorningBriefingAppServerEnvironment,
  getMorningBriefingArchiveRequest,
  getMorningBriefingGoalSetRequest,
  getMorningBriefingInitializeRequest,
  getMorningBriefingPinnedThreadsRequest,
  getMorningBriefingPinRequest,
  getMorningBriefingPresentationThreadName,
  getMorningBriefingPresentationThreadStartRequest,
  getMorningBriefingPresentationTurnStartRequest,
  getMorningBriefingResearchThreadName,
  getMorningBriefingResearchThreadStartRequest,
  getMorningBriefingResearchTurnStartRequest,
  getMorningBriefingThreadIdsToUnpin,
  getMorningBriefingUnpinRequest,
  isMorningBriefingResearchReadyToArchive,
  syncMorningBriefingToObsidian,
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

  test("pins today's presentation and unpins older briefing presentations", () => {
    const currentThreadId = "thread-current"

    expect(getMorningBriefingPinRequest(currentThreadId)).toEqual({
      method: "thread/section/move",
      id: 9,
      params: {
        threadId: currentThreadId,
        sectionId: "01984de2-8f74-7c91-a3b2-5c5e937cf318",
      },
    })
    expect(getMorningBriefingPinnedThreadsRequest()).toEqual({
      method: "thread/list",
      id: 10,
      params: {
        limit: 100,
        sectionId: "01984de2-8f74-7c91-a3b2-5c5e937cf318",
        useStateDbOnly: true,
      },
    })
    expect(
      getMorningBriefingThreadIdsToUnpin(
        [
          { id: currentThreadId, name: "Morning briefing – September 1, 2026" },
          { id: "thread-previous", name: "Morning briefing – August 31, 2026" },
          { id: "thread-diagnostics", name: "Morning briefing diagnostics – August 31, 2026" },
          { id: "thread-unrelated", name: "Project status" },
        ],
        currentThreadId,
      ),
    ).toEqual(["thread-previous"])
    expect(getMorningBriefingUnpinRequest("thread-previous", 11)).toEqual({
      method: "thread/section/move",
      id: 11,
      params: { threadId: "thread-previous", sectionId: null },
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

  test("resumes Obsidian Sync and waits for the vault to finish syncing", async () => {
    const commands: string[][] = []
    const statuses = ["status: syncing", "status: synced"]
    let obsidianOpened = false
    let syncStartAttempts = 0

    await syncMorningBriefingToObsidian({
      maxStatusChecks: 2,
      openObsidian: async () => {
        obsidianOpened = true
      },
      runObsidian: async arguments_ => {
        commands.push(arguments_)
        if (arguments_[1] === "sync" && syncStartAttempts++ === 0) {
          throw new Error("Obsidian is still opening")
        }
        return arguments_[1] === "sync:status" ? (statuses.shift() ?? "") : ""
      },
      wait: async () => undefined,
    })

    expect(obsidianOpened).toBe(true)
    expect(commands).toEqual([
      ["vault=notes", "sync", "on"],
      ["vault=notes", "sync", "on"],
      ["vault=notes", "sync:status"],
      ["vault=notes", "sync:status"],
    ])
  })
})
