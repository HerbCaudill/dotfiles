import { describe, expect, test, vi } from "vitest"

import { syncGithubPrTasks } from "../syncGithubPrTasks.ts"

const reviewerNotification = {
  id: "1",
  reason: "review_requested",
  updated_at: "2026-04-15T10:00:00Z",
  subject: {
    title: "Add the thing",
    type: "PullRequest",
    url: "https://api.github.com/repos/HerbCaudill/dotfiles/pulls/123",
  },
}

const assigneeNotification = {
  id: "2",
  reason: "assign",
  updated_at: "2026-04-15T10:05:00Z",
  subject: {
    title: "Fix the bug",
    type: "PullRequest",
    url: "https://api.github.com/repos/HerbCaudill/tools/pulls/55",
  },
}

describe("syncGithubPrTasks", () => {
  test("creates Google Tasks for assigned and review-requested pull requests", async () => {
    const createdTasks: Array<{ title: string; notes: string }> = []
    const saveState = vi.fn()

    await syncGithubPrTasks({
      now: () => "2026-04-15T10:10:00Z",
      loadState: async () => ({
        lastCheckedAt: "2026-04-15T09:00:00Z",
        processedEventKeys: [],
      }),
      listNotifications: async () => [
        {
          id: "3",
          reason: "comment",
          updated_at: "2026-04-15T10:02:00Z",
          subject: {
            title: "Ignore me",
            type: "PullRequest",
            url: "https://api.github.com/repos/HerbCaudill/dotfiles/pulls/999",
          },
        },
        assigneeNotification,
        reviewerNotification,
      ],
      listOpenPullRequestLinks: async () => [],
      createTask: async task => {
        createdTasks.push(task)
      },
      saveState,
    })

    expect(createdTasks).toEqual([
      {
        title: "PR: Add the thing",
        notes: "https://github.com/HerbCaudill/dotfiles/pull/123",
      },
      {
        title: "PR: Fix the bug",
        notes: "https://github.com/HerbCaudill/tools/pull/55",
      },
    ])

    expect(saveState).toHaveBeenCalledTimes(2)
    expect(saveState).toHaveBeenNthCalledWith(1, {
      lastCheckedAt: "2026-04-15T10:10:00Z",
      processedEventKeys: ["1:2026-04-15T10:00:00Z"],
    })
    expect(saveState).toHaveBeenNthCalledWith(2, {
      lastCheckedAt: "2026-04-15T10:10:00Z",
      processedEventKeys: ["1:2026-04-15T10:00:00Z", "2:2026-04-15T10:05:00Z"],
    })
  })

  test("creates a task for a new update when no open task remains", async () => {
    const createdTasks: Array<{ title: string; notes: string }> = []
    const saveState = vi.fn()

    await syncGithubPrTasks({
      now: () => "2026-04-15T11:00:00Z",
      loadState: async () => ({
        lastCheckedAt: "2026-04-15T10:10:00Z",
        processedEventKeys: ["1:2026-04-15T10:00:00Z"],
      }),
      listNotifications: async () => [
        reviewerNotification,
        {
          ...reviewerNotification,
          updated_at: "2026-04-15T10:30:00Z",
        },
      ],
      listOpenPullRequestLinks: async () => [],
      createTask: async task => {
        createdTasks.push(task)
      },
      saveState,
    })

    expect(createdTasks).toEqual([
      {
        title: "PR: Add the thing",
        notes: "https://github.com/HerbCaudill/dotfiles/pull/123",
      },
    ])

    expect(saveState).toHaveBeenCalledWith({
      lastCheckedAt: "2026-04-15T11:00:00Z",
      processedEventKeys: ["1:2026-04-15T10:00:00Z", "1:2026-04-15T10:30:00Z"],
    })
  })
  test("reassignment reuses an open task and records the event as processed", async () => {
    const createTask = vi.fn()
    const saveState = vi.fn()
    const result = await syncGithubPrTasks({
      now: () => "2026-04-15T11:00:00Z",
      loadState: async () => ({ lastCheckedAt: null, processedEventKeys: [] }),
      listNotifications: async () => [assigneeNotification],
      listOpenPullRequestLinks: async () => ["https://github.com/HerbCaudill/tools/pull/55"],
      createTask,
      saveState,
    })
    expect(createTask).not.toHaveBeenCalled()
    expect(result.createdCount).toBe(0)
    expect(saveState).toHaveBeenCalledWith({
      lastCheckedAt: "2026-04-15T11:00:00Z",
      processedEventKeys: ["2:2026-04-15T10:05:00Z"],
    })
  })

  test("creates only one task for multiple updates to the same PR in one run", async () => {
    const createTask = vi.fn()
    const result = await syncGithubPrTasks({
      now: () => "2026-04-15T11:00:00Z",
      loadState: async () => ({ lastCheckedAt: null, processedEventKeys: [] }),
      listNotifications: async () => [
        assigneeNotification,
        { ...assigneeNotification, updated_at: "2026-04-15T10:30:00Z" },
      ],
      listOpenPullRequestLinks: async () => [],
      createTask,
      saveState: vi.fn(),
    })
    expect(createTask).toHaveBeenCalledTimes(1)
    expect(result.createdCount).toBe(1)
  })
})
