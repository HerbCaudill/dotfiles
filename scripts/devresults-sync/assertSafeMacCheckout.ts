import { runCommand } from "./runCommand.ts"

/** Ensure drsync is running in a macOS clone, not the mounted Windows checkout. */
export function assertSafeMacCheckout() {
  const repoRoot = runCommand("git", ["rev-parse", "--show-toplevel"])

  if (repoRoot.startsWith("/Volumes/")) {
    throw new Error("drsync must run from a macOS clone, not the mounted Windows checkout.")
  }
}
