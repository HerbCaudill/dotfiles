import { describe, expect, it, vi } from "vitest"
import { reconcileWatch } from "../reconcileWatch.ts"

describe("Beads wake decisions", () => {
  it("wakes once for eligible work and stays quiet through idle checks and restarts", async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const work = [{ id: "task-a", status: "open", issue_type: "task" }]
    const first = await reconcileWatch(undefined, work, [], send)
    expect(send).toHaveBeenCalledWith(["task-a"])
    await reconcileWatch(JSON.parse(JSON.stringify(first)), work, [], send)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("excludes epics, human work, claimed work and work already in progress", async () => {
    const send = vi.fn()
    await reconcileWatch(
      undefined,
      [
        { id: "epic", issue_type: "epic" },
        { id: "human", labels: ["human"] },
        { id: "claimed", assignee: "worker" },
        { id: "active", status: "in_progress" },
        { id: "race", status: "open" },
      ],
      ["race"],
      send,
    )
    expect(send).not.toHaveBeenCalled()
  })

  it("wakes waiting work when an active task releases capacity", async () => {
    const send = vi.fn()
    const work = [{ id: "waiting" }]
    const prior = { ready: ["waiting"], active: ["implementation"] }
    await reconcileWatch(prior, work, ["implementation"], send)
    expect(send).not.toHaveBeenCalled()
    await reconcileWatch(prior, work, [], send)
    expect(send).toHaveBeenCalledWith(["waiting"])
  })

  it("re-notifies a task that leaves readiness and later becomes ready again", async () => {
    const send = vi.fn()
    const state = await reconcileWatch({ ready: ["task-a"], active: [] }, [], [], send)
    await reconcileWatch(state, [{ id: "task-a" }], [], send)
    expect(send).toHaveBeenCalledWith(["task-a"])
  })

  it("does not acknowledge a failed delivery, allowing the saved state to retry", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("T3 offline")).mockResolvedValue(undefined)
    const prior = { ready: [], active: [] }
    await expect(reconcileWatch(prior, [{ id: "task-a" }], [], send)).rejects.toThrow("T3 offline")
    expect(prior.ready).toEqual([])
    await reconcileWatch(prior, [{ id: "task-a" }], [], send)
    expect(send).toHaveBeenCalledTimes(2)
  })
})
