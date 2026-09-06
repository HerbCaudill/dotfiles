import type { PrIntent, TasksCall } from "./types.ts"
import { writePrPhase } from "./writePrPhase.ts"

/** Capture into Inbox and save the original PR URL without rewriting later human decisions. */
export async function completePrEvent(
  /** Stored immutable input and its last durable phase. */
  intent: PrIntent,
  /** Explicit CLI boundary; this function never opens peer storage. */
  call: TasksCall,
  /** Save confirmed identity before proceeding to the separate notes operation. */
  checkpoint: (intent: PrIntent) => Promise<void>,
): Promise<PrIntent> {
  if (intent.phase === "saved") return intent
  if (intent.phase === "prepared") {
    const eventKey = `github-pr:${intent.eventKey}`
    const result = await writePrPhase(
      call,
      "capture",
      { title: intent.title, eventKey },
      intent.captureRequestId,
    )
    const id = result.createdIds?.length === 1 ? result.createdIds[0] : undefined
    if (
      !id ||
      !result.records?.some(
        record =>
          record.kind === "task" &&
          record.id === id &&
          record.creationKey === `capture:${eventKey}`,
      )
    )
      throw new Error("Tasks invalid response: capture identity was not established")
    intent = { ...intent, phase: "captured", taskId: id }
    await checkpoint(intent)
  }
  if (!intent.taskId) throw new Error("Tasks captured phase is missing its original task identity")
  const result = await writePrPhase(
    call,
    "save-description",
    {
      target: "task",
      id: intent.taskId,
      editorId: "github-pr-task-sync",
      submissionId: intent.descriptionRequestId,
      base: "",
      text: intent.notes,
    },
    intent.descriptionRequestId,
  )
  if (!result.affectedIds?.includes(intent.taskId))
    throw new Error("Tasks invalid response: description target was not acknowledged")
  const saved = { ...intent, phase: "saved" as const }
  await checkpoint(saved)
  return saved
}
