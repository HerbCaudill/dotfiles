import { spawnSync } from "node:child_process"
import { beforeEach, expect, test, vi } from "vitest"

import { listOpenPullRequestLinks } from "../listOpenPullRequestLinks.ts"

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }))

beforeEach(() => vi.mocked(spawnSync).mockReset())

test("finds PR links in edited notes across task lists and all result pages", async () => {
  const pages = [
    { items: [{ id: "todo" }], nextPageToken: "more-lists" },
    { items: [{ id: "today" }] },
    { items: [{ notes: "Unrelated task" }], nextPageToken: "more-tasks" },
    { items: [{ notes: "Review https://github.com/DevResults/DevResults/pull/7415\nMy notes" }] },
    { items: [{ notes: "https://github.com/HerbCaudill/dotfiles/pull/123" }, {}] },
  ]
  for (const page of pages) {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: JSON.stringify(page),
      stderr: "",
      pid: 1,
      signal: null,
      output: [],
    })
  }
  expect(await listOpenPullRequestLinks()).toEqual([
    "https://github.com/DevResults/DevResults/pull/7415",
    "https://github.com/HerbCaudill/dotfiles/pull/123",
  ])
  const params = vi.mocked(spawnSync).mock.calls.map(call => JSON.parse((call[1] as string[])[4]))
  expect(params[1].pageToken).toBe("more-lists")
  expect(params[3]).toMatchObject({ tasklist: "todo", pageToken: "more-tasks" })
  expect(params[4]).toMatchObject({ tasklist: "today", showCompleted: false, showDeleted: false })
})

test("fails the lookup if Google Tasks cannot be read", async () => {
  vi.mocked(spawnSync).mockReturnValueOnce({
    status: 1,
    stdout: "",
    stderr: "Unavailable",
    pid: 1,
    signal: null,
    output: [],
  })
  await expect(listOpenPullRequestLinks()).rejects.toThrow("task lookup failed: Unavailable")
})
