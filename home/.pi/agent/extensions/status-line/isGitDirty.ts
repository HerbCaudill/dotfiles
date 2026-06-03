import { execSync } from "node:child_process"

/** Check whether a git repository has uncommitted changes. */
export function isGitDirty(
  /** The current working directory. */
  cwd: string,
): boolean {
  try {
    const status = execSync("git -c core.fileMode=false status --porcelain", {
      cwd,
      encoding: "utf-8",
      timeout: 1000,
    }).trim()

    return status.length > 0
  } catch {
    return false
  }
}
