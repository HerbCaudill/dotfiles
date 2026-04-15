import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { getGithubPrTaskStatePath } from "./getGithubPrTaskStatePath.ts"
import type { GithubPrTaskState } from "./types.ts"

/** Persist the GitHub PR task sync state to disk. */
export async function saveGithubPrTaskState(
  /** The state to save. */
  state: GithubPrTaskState,
): Promise<void> {
  const path = getGithubPrTaskStatePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8")
}
