import { getRepoRoot } from "./getRepoRoot.ts"

/** Ensure drsync is running in a macOS clone, not the mounted Windows checkout. */
export function assertSafeMacCheckout() {
  const repoRoot = getRepoRoot()

  if (repoRoot.startsWith("/Volumes/")) {
    throw new Error("drsync must run from a macOS clone, not the mounted Windows checkout.")
  }
}
