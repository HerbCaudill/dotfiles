import { runCommand } from "./runCommand.ts"

/** Get the current repository root. */
export function getRepoRoot() {
  return runCommand("git", ["rev-parse", "--show-toplevel"])
}
