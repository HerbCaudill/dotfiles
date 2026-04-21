import { spawnSync } from "node:child_process"

/** Check whether the SSH host accepts a simple non-interactive connection. */
export async function isSshHostReady(
  /** The SSH host alias. */
  sshHost: string,
): Promise<boolean> {
  const result = spawnSync(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", sshHost, "exit"],
    { encoding: "utf8" },
  )

  return result.status === 0
}
