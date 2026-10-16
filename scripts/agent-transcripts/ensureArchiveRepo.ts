import { existsSync } from "node:fs"
import { join } from "node:path"
import { runCommand } from "./runCommand.ts"

/** Require an enrolled working clone rather than silently creating a disconnected archive. */
export const ensureArchiveRepo = (
  /** Working clone of the private archive. */
  archiveRepositoryPath: string,
): void => {
  if (!existsSync(join(archiveRepositoryPath, ".git"))) {
    throw new Error(
      `Clone HerbCaudill/agent-transcripts into ${archiveRepositoryPath} before syncing`,
    )
  }
  runCommand("git", ["remote", "get-url", "origin"], { cwd: archiveRepositoryPath })
  const branch = runCommand("git", ["branch", "--show-current"], {
    cwd: archiveRepositoryPath,
  }).stdout.trim()
  if (branch !== "main") throw new Error("Archive sync requires the main branch")
}
