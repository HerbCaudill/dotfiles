import { spawnSync } from "node:child_process"

/** Start the named Parallels VM. */
export async function startVm(
  /** The Parallels VM name. */
  vmName: string,
): Promise<void> {
  const result = spawnSync("prlctl", ["start", vmName], { encoding: "utf8" })

  if (result.status !== 0) {
    const output =
      result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status ?? "unknown"}`
    throw new Error(`Unable to start VM ${vmName}: ${output}`)
  }
}
