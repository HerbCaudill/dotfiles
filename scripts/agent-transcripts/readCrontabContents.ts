import { spawnSync } from "node:child_process"

/** Read the current user's crontab, returning an empty string if none exists. */
export const readCrontabContents = () => {
  const result = spawnSync("crontab", ["-l"], {
    encoding: "utf8",
  })

  if (result.status === 0) {
    return result.stdout
  }

  const stderr = result.stderr?.trim() ?? ""
  if (result.status === 1 && stderr.includes("no crontab")) {
    return ""
  }

  throw new Error(`crontab -l failed: ${stderr || `exit ${result.status ?? "unknown"}`}`)
}
