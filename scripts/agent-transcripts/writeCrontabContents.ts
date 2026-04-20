import { spawnSync } from "node:child_process"

/** Replace the current user's crontab with the provided contents. */
export const writeCrontabContents = (
  /** The full crontab text to install. */
  crontabContents: string,
): void => {
  const result = spawnSync("crontab", ["-"], {
    encoding: "utf8",
    input: crontabContents,
  })

  if (result.status === 0) {
    return
  }

  const stderr = result.stderr?.trim() ?? ""
  throw new Error(`crontab - failed: ${stderr || `exit ${result.status ?? "unknown"}`}`)
}
