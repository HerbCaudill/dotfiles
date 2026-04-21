import { spawnSync } from "node:child_process"

import type { VmStatus } from "./types.ts"

/** Return whether the named Parallels VM is currently running. */
export async function getVmStatus(
  /** The Parallels VM name. */
  vmName: string,
): Promise<VmStatus> {
  const result = spawnSync("prlctl", ["status", vmName], { encoding: "utf8" })

  if (result.status !== 0) {
    const output =
      result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status ?? "unknown"}`
    throw new Error(`Unable to get VM status for ${vmName}: ${output}`)
  }

  return result.stdout.includes("running") ? "running" : "stopped"
}
