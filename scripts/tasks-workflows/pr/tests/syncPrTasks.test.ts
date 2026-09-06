import { expect, test, vi } from "vitest"
import { syncPrTasks } from "../syncPrTasks.ts"
import type { PrState, PrIntent } from "../types.ts"

const notifications = [1, 2].map(id => ({
  id: String(id),
  reason: "review_requested",
  updated_at: `2026-09-06T10:0${id}:00Z`,
  subject: {
    title: `Change ${id}`,
    type: "PullRequest",
    url: `https://api.github.com/repos/example/repo/pulls/${id}`,
  },
}))

test("retains the old cursor through a partial batch and resumes only unfinished events", async () => {
  let persisted: PrState = {
    lastCheckedAt: "2026-09-06T09:00:00Z",
    processedEventKeys: ["legacy"],
    intents: {},
    retained: { original: true },
  }
  const finished: string[] = []
  let fail = true
  const dependencies = {
    now: () => "2026-09-06T11:00:00Z",
    loadState: async () => structuredClone(persisted),
    saveState: async (state: PrState) => {
      persisted = structuredClone(state)
    },
    listNotifications: vi.fn(async () => notifications),
    completeEvent: async (intent: PrIntent, checkpoint: (intent: PrIntent) => Promise<void>) => {
      if (intent.eventKey.startsWith("2:") && fail) throw new Error("Service unavailable")
      const saved = { ...intent, phase: "saved" as const, taskId: `task-${intent.eventKey[0]}` }
      await checkpoint(saved)
      finished.push(intent.eventKey)
      return saved
    },
  }
  await expect(syncPrTasks(dependencies)).rejects.toThrow("Service unavailable")
  expect(persisted.lastCheckedAt).toBe("2026-09-06T09:00:00Z")
  expect(persisted.processedEventKeys).toEqual(["legacy", "1:2026-09-06T10:01:00Z"])
  expect(persisted.intents["1:2026-09-06T10:01:00Z"].taskId).toBe("task-1")
  fail = false
  await syncPrTasks(dependencies)
  expect(dependencies.listNotifications).toHaveBeenLastCalledWith("2026-09-06T09:00:00Z")
  expect(finished).toEqual(["1:2026-09-06T10:01:00Z", "2:2026-09-06T10:02:00Z"])
  expect(persisted).toMatchObject({
    lastCheckedAt: "2026-09-06T11:00:00Z",
    retained: { original: true },
  })
})
