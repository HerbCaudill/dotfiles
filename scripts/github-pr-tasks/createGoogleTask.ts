import { spawnSync } from "node:child_process"

import { DEFAULT_TASK_LIST_ID } from "./constants.ts"
import type { GoogleTaskRequest } from "./types.ts"

/** Create one Google Task in the default task list. */
export async function createGoogleTask(
  /** The Google Task payload to create. */
  task: GoogleTaskRequest,
): Promise<void> {
  const result = spawnSync(
    "gws",
    [
      "tasks",
      "tasks",
      "insert",
      "--params",
      JSON.stringify({ tasklist: DEFAULT_TASK_LIST_ID }),
      "--json",
      JSON.stringify(task),
    ],
    {
      encoding: "utf8",
    },
  )

  if (result.status === 0) {
    return
  }

  const output =
    result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status ?? "unknown"}`
  throw new Error(`gws task creation failed: ${output}`)
}
