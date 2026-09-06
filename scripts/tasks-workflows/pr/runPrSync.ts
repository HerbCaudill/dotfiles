import { dirname } from "node:path"
import { getGithubPrTaskStatePath } from "../../github-pr-tasks/getGithubPrTaskStatePath.ts"
import { acquirePrLock } from "./acquirePrLock.ts"
import { bindPrState } from "./bindPrState.ts"
import { createTasksCall } from "./createTasksCall.ts"
import { listPrNotifications } from "./listPrNotifications.ts"
import { loadPrState } from "./loadPrState.ts"
import { savePrState } from "./savePrState.ts"
import { completePrEvent } from "./completePrEvent.ts"
import { syncPrTasks } from "./syncPrTasks.ts"

/** Inert entrypoint until the reviewed wrapper and scheduler cutover selects it. */
export async function runPrSync(
  /** Public binding and explicit freshness supplied by activation, never inferred from upload. */
  context: {
    spaceId: string
    freshness: "local" | "edge-upload" | "converged"
  },
) {
  const call = createTasksCall(context)
  const path = getGithubPrTaskStatePath()
  const release = await acquirePrLock(dirname(path))
  try {
    const status = await call("status", {})
    if (status.status !== "ok") throw new Error(`Tasks ${status.status}: PR sync deferred`)
    return await syncPrTasks({
      now: () => new Date().toISOString(),
      loadState: async () => bindPrState(await loadPrState(path), context),
      saveState: state => savePrState(state, path),
      listNotifications: listPrNotifications,
      completeEvent: (intent, checkpoint) => completePrEvent(intent, call, checkpoint),
    })
  } finally {
    release()
  }
}
