import { runCommand } from "./runCommand.ts"

/** Get the current Git branch name. */
export function getCurrentBranch() {
  const branch = runCommand("git", ["branch", "--show-current"])

  if (!branch) throw new Error("drsync requires a named Git branch, not a detached HEAD.")

  return branch
}
