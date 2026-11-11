import { describe, expect, it, vi } from "vitest"

import { createEmailTasksClient, type TasksRunner } from "../emailTasks.ts"

describe("createEmailTasksClient", () => {
  it("captures an Inbox item with its request ID and returns the new task ID", async () => {
    const run = vi
      .fn<TasksRunner>()
      .mockResolvedValue(reply(0, { status: "saved", result: { createdIds: ["task-9"] } }))
    const tasks = createEmailTasksClient({ run, spaceId: SPACE })

    await expect(tasks.capture("Approve", "event-1", "request-1")).resolves.toBe("task-9")
    expect(run).toHaveBeenCalledWith(
      ["capture", "--timezone", "Europe/Madrid", "--input", "-", "--request-id", "request-1"],
      '{"title":"Approve","eventKey":"event-1"}\n',
    )
  })

  it("resolves an unconfirmed write through inspect and retry", async () => {
    const run = vi
      .fn<TasksRunner>()
      .mockResolvedValueOnce(reply(5, { status: "unconfirmed" }))
      .mockResolvedValueOnce(reply(0, { status: "ok", receipt: { request: { requestId: "r1" } } }))
      .mockResolvedValueOnce(reply(0, { status: "saved", result: {} }))
    const tasks = createEmailTasksClient({ run, spaceId: SPACE })

    await tasks.complete("task-9", "r1")

    expect(run.mock.calls.map(([args]) => args[0])).toEqual(["complete", "inspect", "retry"])
  })

  it("refuses a response from another space or one whose exit code disagrees", async () => {
    const otherSpace = createEmailTasksClient({
      run: async () =>
        reply(0, {
          status: "saved",
          result: { createdIds: ["x"] },
          metadata: { spaceId: "OTHER" },
        }),
      spaceId: SPACE,
    })
    const mismatched = createEmailTasksClient({
      run: async () => reply(0, { status: "invalid" }),
      spaceId: SPACE,
    })

    await expect(otherSpace.capture("t", "e", "r")).rejects.toThrow("unexpected space")
    await expect(mismatched.capture("t", "e", "r")).rejects.toThrow("disagree")
  })
})

/** Build a CLI reply in the enrolled space. */
function reply(
  /** Exit code. */
  code: number,
  /** Response body. */
  response: Record<string, unknown>,
) {
  return { code, stdout: JSON.stringify({ metadata: { spaceId: SPACE }, ...response }) }
}

const SPACE = "SPACE1"
