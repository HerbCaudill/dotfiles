import { runCommand } from "./runCommand.ts"

/** Commit only the current machine's archive files. */
export const commitArchiveChanges = (
  /** Working archive repository. */
  archiveRepositoryPath: string,
  /** Stable machine name. */
  machine: string,
): boolean => {
  const options = { cwd: archiveRepositoryPath }
  const staged = runCommand("git", ["diff", "--cached", "--name-only"], options).stdout.trim()
  if (staged) throw new Error("Archive has staged changes; finish or unstage them before syncing")
  runCommand("git", ["add", "--all", "--", `machines/${machine}`], options)
  if (!runCommand("git", ["diff", "--cached", "--name-only"], options).stdout.trim()) return false
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
  runCommand(
    "git",
    [
      "commit",
      "-m",
      `Sync ${machine} agent transcripts: ${timestamp}`,
      "-m",
      `Save ${machine}'s conversation snapshots for searches from either computer.`,
    ],
    {
      ...options,
      env: { ...process.env, GIT_AUTHOR_NAME: "Codex", GIT_AUTHOR_EMAIL: "codex@localhost" },
    },
  )
  return true
}
