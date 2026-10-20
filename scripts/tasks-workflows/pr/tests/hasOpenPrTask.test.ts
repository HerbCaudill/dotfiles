import { expect, test, vi } from "vitest"
import { hasOpenPrTask } from "../hasOpenPrTask.ts"
import type { TasksCall } from "../types.ts"

const link = "https://github.com/example/repo/pull/74"

test("finds an unfinished task for the exact PR on any page", async () => {
  const call = vi.fn<TasksCall>(async (_command, input) => ({
    status: "ok",
    result: input.continuation
      ? {
          status: "ok",
          items: [
            { kind: "task", status: "inbox", title: "Review it", description: `PR: ${link}` },
          ],
          continuation: null,
        }
      : {
          status: "ok",
          items: [
            { kind: "task", status: "done", description: link },
            { kind: "task", status: "open", description: `${link}32` },
          ],
          continuation: "next",
        },
  }))
  expect(await hasOpenPrTask(link, call)).toBe(true)
  expect(call).toHaveBeenLastCalledWith("search", {
    text: link,
    kind: "task",
    continuation: "next",
  })
})

test("ignores completed tasks and other PRs that share the URL prefix", async () => {
  const call = vi.fn<TasksCall>(async () => ({
    status: "ok",
    result: {
      status: "ok",
      items: [
        { kind: "task", status: "done", description: link },
        { kind: "task", status: "open", description: `${link}32` },
      ],
      continuation: null,
    },
  }))
  expect(await hasOpenPrTask(link, call)).toBe(false)
})

test("defers when the lookup is unavailable", async () => {
  const call = vi.fn<TasksCall>(async () => ({ status: "unavailable" }))
  await expect(hasOpenPrTask(link, call)).rejects.toThrow("deferred")
})
