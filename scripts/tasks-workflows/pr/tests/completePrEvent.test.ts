import { expect, test, vi } from "vitest"
import { createPrIntent } from "../createPrIntent.ts"
import { completePrEvent } from "../completePrEvent.ts"
import type { PrIntent, TasksResponse } from "../types.ts"

const initial = createPrIntent("notification:2026-09-06T10:00:00Z", {
  title: "PR: Original title",
  notes: "https://github.com/example/repo/pull/1",
})
const savedCapture: TasksResponse = {
  status: "saved",
  requestId: initial.captureRequestId,
  result: {
    status: "saved",
    createdIds: ["task-1"],
    records: [{ kind: "task", id: "task-1", creationKey: `capture:github-pr:${initial.eventKey}` }],
  },
}
const savedDescription: TasksResponse = {
  status: "saved",
  requestId: initial.descriptionRequestId,
  result: { status: "saved", affectedIds: ["task-1"] },
}

test("resumes a lost capture reply through its same identity and then checkpoints the notes phase", async () => {
  let persisted: PrIntent = structuredClone(initial)
  let loseReply = true
  const call = vi.fn(async (command: string) => {
    if (command === "capture") {
      if (loseReply) {
        loseReply = false
        throw new Error("Reply lost")
      }
      return savedCapture
    }
    return savedDescription
  })
  const checkpoint = async (intent: PrIntent) => {
    persisted = structuredClone(intent)
  }
  await expect(completePrEvent(persisted, call, checkpoint)).rejects.toThrow("Reply lost")
  const result = await completePrEvent(persisted, call, checkpoint)
  expect(result).toMatchObject({ phase: "saved", taskId: "task-1" })
  expect(call.mock.calls.filter(([command]) => command === "capture")).toHaveLength(2)
  expect(call).toHaveBeenNthCalledWith(
    1,
    "capture",
    { title: initial.title, eventKey: `github-pr:${initial.eventKey}` },
    initial.captureRequestId,
  )
  expect(call).toHaveBeenNthCalledWith(
    2,
    "capture",
    { title: initial.title, eventKey: `github-pr:${initial.eventKey}` },
    initial.captureRequestId,
  )
  expect(call).toHaveBeenLastCalledWith(
    "save-description",
    {
      target: "task",
      id: "task-1",
      editorId: "github-pr-task-sync",
      submissionId: initial.descriptionRequestId,
      base: "",
      text: initial.notes,
    },
    initial.descriptionRequestId,
  )
})

test("explicitly inspects and safely retries uncertainty without changing the notes draft", async () => {
  const intent: PrIntent = { ...initial, phase: "captured", taskId: "task-1" }
  const call = vi
    .fn()
    .mockResolvedValueOnce({ status: "unconfirmed", requestId: initial.descriptionRequestId })
    .mockResolvedValueOnce({
      status: "unconfirmed",
      receipt: { phase: "unconfirmed", request: { requestId: initial.descriptionRequestId } },
    })
    .mockResolvedValueOnce(savedDescription)
  expect(await completePrEvent(intent, call, async () => {})).toMatchObject({ phase: "saved" })
  expect(call.mock.calls.map(([command]) => command)).toEqual([
    "save-description",
    "inspect",
    "retry",
  ])
})

test("preserves renamed or completed tasks and stops on description conflicts or service failure", async () => {
  for (const status of ["conflict", "unavailable", "invalid"] as const) {
    const checkpoint = vi.fn()
    const call = vi.fn().mockResolvedValue({ status })
    await expect(
      completePrEvent({ ...initial, phase: "captured", taskId: "task-1" }, call, checkpoint),
    ).rejects.toThrow(status)
    expect(call.mock.calls.map(([command]) => command)).toEqual(["save-description"])
    expect(checkpoint).not.toHaveBeenCalled()
  }
  const call = vi.fn()
  expect(
    await completePrEvent({ ...initial, phase: "saved", taskId: "task-1" }, call, async () => {}),
  ).toMatchObject({ phase: "saved" })
  expect(call).not.toHaveBeenCalled()
})
