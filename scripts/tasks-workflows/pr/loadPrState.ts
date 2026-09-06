import { readFile } from "node:fs/promises"
import { parsePrState } from "./parsePrState.ts"
import type { PrState } from "./types.ts"

/** Load the existing checkpoint; only a genuinely absent file starts an empty history. */
export async function loadPrState(
  /** Existing PR sync state path, supplied explicitly at activation. */
  path: string,
): Promise<PrState> {
  try {
    return parsePrState(JSON.parse(await readFile(path, "utf8")))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { lastCheckedAt: null, processedEventKeys: [], intents: {} }
    throw error
  }
}
