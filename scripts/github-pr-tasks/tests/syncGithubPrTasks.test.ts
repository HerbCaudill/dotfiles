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

  test("skips processed notification events but creates a new task when the same thread updates again", async () => {
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
})
