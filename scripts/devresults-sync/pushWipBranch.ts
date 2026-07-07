import { runInheritedCommand } from "./runInheritedCommand.ts"

/** Push HEAD to the remote WIP branch. */
export function pushWipBranch(
  /** The WIP branch name */
  wipBranch: string,
) {
  runInheritedCommand("git", ["push", "origin", `HEAD:refs/heads/${wipBranch}`])
}
