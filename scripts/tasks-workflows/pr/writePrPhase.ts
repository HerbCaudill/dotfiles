import type { TasksCall } from "./types.ts"

/** Resume only capture or description through the service's explicit receipt recovery rules. */
export async function writePrPhase(
  /** Bound Tasks CLI, returning all protocol outcomes truthfully. */
  call: TasksCall,
  /** The only two automatic mutations used by this workflow. */
  command: "capture" | "save-description",
  /** Immutable original input retained before the first dispatch. */
  input: Record<string, unknown>,
  /** Original private service receipt identity. */
  requestId: string,
) {
  let response = await call(command, input, requestId)
  if (response.status === "unconfirmed") {
    const inspected = await call("inspect", {}, requestId)
    if (inspected.receipt?.request.requestId !== requestId)
      throw new Error("Tasks unconfirmed: original receipt is unavailable")
    response = await call("retry", {}, requestId)
  }
  if (response.status !== "saved")
    throw new Error(`Tasks ${response.status}: PR phase remains unfinished`)
  if (response.requestId !== requestId || response.result?.status !== "saved")
    throw new Error("Tasks invalid response: saved receipt identity is missing")
  return response.result
}
