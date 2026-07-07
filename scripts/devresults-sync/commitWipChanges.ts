import { WIP_COMMIT_MESSAGE } from "./constants.ts"
import { runCommand } from "./runCommand.ts"
import { runInheritedCommand } from "./runInheritedCommand.ts"

/** Commit current local changes as a save-like WIP commit. */
export function commitWipChanges() {
  const status = runCommand("git", ["status", "--porcelain"])

  if (!status) return

  runInheritedCommand("git", ["add", "-A"])
  runInheritedCommand("git", ["commit", "-m", WIP_COMMIT_MESSAGE])
}
