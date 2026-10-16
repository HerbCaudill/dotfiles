import { arePathsEqual } from "./are-paths-equal.ts"

/** Apply an exact directory or a portable ORG/REPO filter to a recorded working directory. */
export function matchesSessionDirectory(
  /** Working directory recorded by the harness. */
  actual: string | undefined,
  /** Optional exact path on the originating machine. */
  cwd: string | undefined,
  /** Optional repository path beneath Code. */
  project: string | undefined,
) {
  if (
    cwd &&
    (!actual || !arePathsEqual(actual, cwd, /^[a-z]:[\\/]/i.test(actual) ? "win32" : "darwin"))
  )
    return false
  if (!project) return true
  if (!actual) return false
  const normalized = actual.replaceAll("\\", "/").toLowerCase().replace(/\/$/, "")
  return normalized.endsWith(`/code/${project.replaceAll("\\", "/").toLowerCase()}`)
}
