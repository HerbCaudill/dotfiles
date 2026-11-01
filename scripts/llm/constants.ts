import { homedir } from "node:os"
import { join } from "node:path"

/** Private file holding the Artificial Analysis API key. */
export const API_KEY_PATH = join(homedir(), ".config/llm/artificial-analysis-key")

/** Local scores. Artificial Analysis's free tier forbids redistribution, so this stays out of the public repo. */
export const SNAPSHOT_PATH = join(homedir(), ".local/state/llm/frontier.json")

/** Time limit for a run unless the caller sets one. */
export const DEFAULT_TIMEOUT_MS = 45 * 60 * 1_000

/** Time limit for the test call before a variant goes live. */
export const TEST_TIMEOUT_MS = 5 * 60 * 1_000
