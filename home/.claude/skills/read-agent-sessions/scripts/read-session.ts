import { readFileSync, statSync } from "node:fs"
import { parseSession } from "./parse-session.ts"
import { resolveSessionFile } from "./resolve-session-file.ts"
import type { Provider } from "./types.ts"

/** Read and normalize one complete transcript. */
export function readSession(
  /** Path, ID, or ID prefix. */
  value: string,
  /** Harness filter. */
  source: Provider | "all",
  /** Whether to retain tool traffic. */
  includeTools: boolean,
) {
  const file = resolveSessionFile(value, source)
  const stats = statSync(file.path)

  return parseSession(file, readFileSync(file.path, "utf8"), includeTools, stats.mtime)
}
