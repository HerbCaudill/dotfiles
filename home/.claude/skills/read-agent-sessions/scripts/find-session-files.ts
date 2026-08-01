import { existsSync, globSync } from "node:fs"
import { join } from "node:path"
import { claudeSessionsRoot, codexArchivedSessionsRoot, codexSessionsRoot } from "./constants.ts"
import type { Provider, SessionFile } from "./types.ts"

/** Discover local transcript files for the selected harnesses. */
export function findSessionFiles(
  /** Harness filter. */
  source: Provider | "all",
  /** Whether to include archived Codex rollouts. */
  includeArchived: boolean,
) {
  const files: SessionFile[] = []

  if ((source === "all" || source === "claude") && existsSync(claudeSessionsRoot)) {
    files.push(
      ...globSync("**/*.jsonl", {
        cwd: claudeSessionsRoot,
      }).map(path => ({
        provider: "claude" as const,
        path: join(claudeSessionsRoot, path),
      })),
    )
  }

  if ((source === "all" || source === "codex") && existsSync(codexSessionsRoot)) {
    files.push(
      ...globSync("**/*.jsonl", {
        cwd: codexSessionsRoot,
      }).map(path => ({
        provider: "codex" as const,
        path: join(codexSessionsRoot, path),
      })),
    )
  }

  if (
    includeArchived &&
    (source === "all" || source === "codex") &&
    existsSync(codexArchivedSessionsRoot)
  ) {
    files.push(
      ...globSync("**/*.jsonl", {
        cwd: codexArchivedSessionsRoot,
      }).map(path => ({
        provider: "codex" as const,
        path: join(codexArchivedSessionsRoot, path),
      })),
    )
  }

  return files
}
