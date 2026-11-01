import { existsSync, readFileSync } from "node:fs"
import { SNAPSHOT_PATH } from "./constants.ts"
import type { Snapshot } from "./types.ts"

/** Read the local model scores. */
export function readSnapshot(): Snapshot {
  if (!existsSync(SNAPSHOT_PATH))
    throw new Error(`No model scores at ${SNAPSHOT_PATH}. Run: llm refresh`)
  return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"))
}
