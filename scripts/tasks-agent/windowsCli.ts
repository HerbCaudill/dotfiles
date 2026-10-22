import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import { getRelease } from "./getRelease.ts"
import { getWindowsCli } from "./getWindowsCli.ts"

/** Invoke the selected immutable CLI without opening the peer's database. */
async function main() {
  const root = join(homedir(), "AppData/Local/Tasks")
  const release = await getRelease(root)
  const entry = await getWindowsCli(root, release.revision)
  const child = spawn(
    process.execPath,
    [entry, "--socket", join(root, "agent/control.sock"), ...process.argv.slice(2)],
    {
      cwd: release.path,
      stdio: "inherit",
      windowsHide: true,
    },
  )
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", code => resolve(code ?? 4))
  })
}

main().catch(() => {
  process.stderr.write(
    "Tasks CLI is unavailable; inspect the selected release with tasks-agent status.\n",
  )
  process.exitCode = 4
})
