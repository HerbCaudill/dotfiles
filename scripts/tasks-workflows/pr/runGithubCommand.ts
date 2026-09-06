import { execFile } from "node:child_process"
import { promisify } from "node:util"

/** Fetch notification JSON without logging source contents or authentication diagnostics. */
export async function runGithubCommand(
  /** Literal gh API arguments; no shell interpolation. */
  args: string[],
): Promise<string> {
  try {
    return (await promisify(execFile)("gh", args, { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }))
      .stdout
  } catch {
    throw new Error("GitHub notifications unavailable; the checkpoint has not advanced")
  }
}
