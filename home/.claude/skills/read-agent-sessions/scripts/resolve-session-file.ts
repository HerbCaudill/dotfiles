import { existsSync, statSync } from "node:fs"
import { basename, resolve } from "node:path"
import { findSessionFiles } from "./find-session-files.ts"
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
    const provider = candidatePath.includes("/.claude/") ? "claude" : "codex"
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
