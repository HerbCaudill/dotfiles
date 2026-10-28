import { execFileSync } from "node:child_process"

/** Read kernel start time and command so a reused PID cannot adopt a daemon receipt. */
export function getProcessIdentity(
  /** Positive PID to inspect without signalling it. */
  pid: number,
): string | undefined {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined
  try {
    return (
      execFileSync("/bin/ps", ["-p", String(pid), "-o", "lstart=", "-o", "command="], {
        encoding: "utf8",
        env: { ...process.env, LC_ALL: "C", TZ: "UTC" },
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2000,
      }).trim() || undefined
    )
  } catch {
    return undefined
  }
}
