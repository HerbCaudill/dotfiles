import { readFile } from "node:fs/promises"

import { getGithubPrTaskStatePath } from "./getGithubPrTaskStatePath.ts"
import type { GithubPrTaskState } from "./types.ts"

/** Load the persisted GitHub PR task sync state, or return an empty default. */
export async function loadGithubPrTaskState(): Promise<GithubPrTaskState> {
  try {
    const path = getGithubPrTaskStatePath()
    const fileContents = await readFile(path, "utf8")
    const parsedState = JSON.parse(fileContents) as Partial<GithubPrTaskState>

    return {
      lastCheckedAt: parsedState.lastCheckedAt ?? null,
      processedEventKeys:
        Array.isArray(parsedState.processedEventKeys) ?
          parsedState.processedEventKeys.filter(value => typeof value === "string")
        : [],
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        lastCheckedAt: null,
        processedEventKeys: [],
      }
    }

    throw error
  }
}
