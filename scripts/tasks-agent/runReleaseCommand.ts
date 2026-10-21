import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { dirname, join } from "node:path"

/** Run release preparation without shell interpolation or echoing package-manager diagnostics. */
export async function runReleaseCommand(
  /** Executable resolved by the managed launcher. */
  command: string,
  /** Literal argument vector. */
  args: string[],
  /** Isolated source release, never the developer checkout. */
  cwd: string,
): Promise<string> {
  try {
    const windowsPnpm = process.platform === "win32" && command === "pnpm"
    const result = await promisify(execFile)(
      windowsPnpm ? process.execPath : command,
      windowsPnpm
        ? [join(dirname(process.execPath), "node_modules/corepack/dist/pnpm.js"), ...args]
        : args,
      {
        cwd,
        timeout: 600_000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, CI: "true" },
        windowsHide: true,
      },
    )
    return result.stdout
  } catch {
    throw new Error(
      "Release preparation command failed; preserve its staging directory for inspection.",
    )
  }
}
