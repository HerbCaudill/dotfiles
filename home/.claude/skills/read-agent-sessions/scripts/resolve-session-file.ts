import { existsSync, readFileSync, statSync } from "node:fs"
import { basename, resolve } from "node:path"
import { findSessionFiles } from "./find-session-files.ts"
import { parseJsonLines } from "./parse-json-lines.ts"
import type { Provider, SessionFile } from "./types.ts"

/** Resolve a transcript by absolute path, exact ID, or unique ID prefix. */
export function resolveSessionFile(
  /** Path, ID, or ID prefix. */
  value: string,
  /** Harness filter. */
  source: Provider | "all",
) {
  const candidatePath = resolve(value)
  if (existsSync(candidatePath) && statSync(candidatePath).isFile()) {
    const provider = source === "all" ? inferSessionProvider(candidatePath) : source
    return { provider, path: candidatePath } satisfies SessionFile
  }

  const matches = findSessionFiles(source, true).filter(file => {
    const name = basename(file.path, ".jsonl")
    return name === value || name.endsWith(value) || name.includes(value)
  })

  if (matches.length === 0) {
    throw new Error(`No session matches "${value}"`)
  }

  if (matches.length > 1) {
    const ids = matches
      .slice(0, 8)
      .map(file => basename(file.path, ".jsonl"))
      .join("\n")
    throw new Error(`Session prefix is ambiguous:\n${ids}`)
  }

  return matches[0]
}

/** Infer the owning harness from an explicit transcript's record structure. */
function inferSessionProvider(
  /** Absolute transcript path. */
  path: string,
): Provider {
  for (const record of parseJsonLines(readFileSync(path, "utf8"))) {
    if (record.type === "session_meta" || record.type === "response_item") return "codex"
    if (typeof record.sessionId === "string" || record.message) return "claude"
  }

  throw new Error(`Cannot infer the session provider for "${path}"; pass --source claude or codex`)
}
