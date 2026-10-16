import { existsSync } from "node:fs"
import { join, relative } from "node:path"
import { listFilesRecursively } from "./listFilesRecursively.ts"
import type { TranscriptEntry } from "./types.ts"

/** Collect portable conversation files beneath a separate directory for each machine. */
export const collectTranscriptEntries = (
  /** Home directory containing the harness stores. */
  homeDirectory: string,
  /** Stable machine name used by archive readers. */
  machine: string,
): TranscriptEntry[] => {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(machine)) throw new Error("Invalid archive machine name")

  const roots = [
    ".claude/projects",
    ".codex/sessions",
    ".codex/archived_sessions",
    ".pi/agent/sessions",
  ]
  const paths = [".claude/history.jsonl", ".codex/history.jsonl"]
    .map(path => join(homeDirectory, path))
    .filter(path => existsSync(path))
    .concat(
      roots.flatMap(root =>
        listFilesRecursively(join(homeDirectory, root)).filter(path => path.endsWith(".jsonl")),
      ),
    )

  return paths
    .map(absoluteSourcePath => {
      const sourceRelativePath = relative(homeDirectory, absoluteSourcePath)
      return {
        absoluteSourcePath,
        sourceRelativePath,
        archiveRelativePath: join("machines", machine, sourceRelativePath.slice(1)),
      }
    })
    .sort((left, right) => left.archiveRelativePath.localeCompare(right.archiveRelativePath))
}
