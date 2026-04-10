import { runCommand } from "./runCommand.mjs"

/** Commit managed archive changes when the sync produced a diff. */
export const commitArchiveChanges = (
  /** The absolute path to the archive repository. */
  archiveRepositoryPath,
) => {
  runCommand("git", ["add", "--all", "--", ".gitignore", "README.md", "sources"], {
    cwd: archiveRepositoryPath,
  })

  const diffResult = runCommand("git", ["diff", "--cached", "--name-only"], {
    cwd: archiveRepositoryPath,
  })
  const changedPaths = diffResult.stdout
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)

  if (changedPaths.length === 0) {
    return false
  }

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
  runCommand("git", ["commit", "-m", `Sync agent transcripts: ${timestamp}`], {
    cwd: archiveRepositoryPath,
  })

  return true
}
