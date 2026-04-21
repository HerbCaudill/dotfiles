import { spawnSync } from "node:child_process"

import type { OpenRemoteFolderOptions } from "./types.ts"

/** Open a remote SSH folder in VS Code. */
export async function openRemoteFolder(
  /** The remote host and folder to open. */
  options: OpenRemoteFolderOptions,
): Promise<void> {
  const result = spawnSync(
    "code",
    ["--remote", `ssh-remote+${options.sshHost}`, options.remoteFolderPath],
    { encoding: "utf8" },
  )

  if (result.status !== 0) {
    const output =
      result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status ?? "unknown"}`
    throw new Error(`Unable to open ${options.remoteFolderPath} on ${options.sshHost}: ${output}`)
  }
}
