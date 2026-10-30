import { spawn, spawnSync } from "node:child_process"
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir, setPriority, constants } from "node:os"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

/** Bound mini work to twenty hours and keep 06:00–09:00 free for the briefing. */
export function refreshBudget(now: Date, cpu: boolean): number {
  if (!cpu) return 2 * 3600_000
  if (now.getHours() >= 6 && now.getHours() < 9) return 0
  const cutoff = new Date(now)
  cutoff.setHours(6, 0, 0, 0)
  if (cutoff <= now) cutoff.setDate(cutoff.getDate() + 1)
  return Math.min(20 * 3600_000, cutoff.getTime() - now.getTime())
}

/** Refresh only the local index, preserving completed embedding batches on interruption. */
async function main() {
  const cpu = process.platform === "win32"
  const budget = refreshBudget(new Date(), cpu)
  if (!budget) return console.log("QMD refresh deferred for the briefing window")
  const state = join(homedir(), ".local", "state", "qmd")
  mkdirSync(state, { recursive: true })
  const lock = join(state, "refresh.lock")
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"))
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Invalid lock: ${lock}`)
    try {
      process.kill(pid, 0)
      return console.log(`QMD refresh already running: ${pid}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error
      unlinkSync(lock)
    }
  }
  const descriptor = openSync(lock, "wx")
  writeFileSync(descriptor, String(process.pid))
  closeSync(descriptor)
  const deadline = Date.now() + budget
  try {
    console.log(
      `${new Date().toISOString()} QMD refresh started; deadline ${new Date(deadline).toISOString()}`,
    )
    const qmd = cpu
      ? join(dirname(process.execPath), "node_modules", "@tobilu", "qmd", "bin", "qmd")
      : join(homedir(), ".local", "bin", "qmd")
    for (const args of [
      ["update"],
      ["embed", "--timeout", "0", ...(cpu ? ["--no-gpu", "--max-docs-per-batch", "1"] : [])],
    ]) {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(cpu ? process.execPath : qmd, cpu ? [qmd, ...args] : args, {
          stdio: "inherit",
          detached: !cpu,
          windowsHide: true,
          env: {
            ...process.env,
            ...(cpu ? { QMD_FORCE_CPU: "1", QMD_EMBED_PARALLELISM: "1" } : {}),
          },
        })
        if (cpu && child.pid) setPriority(child.pid, constants.priority.PRIORITY_LOW)
        const timer = setTimeout(
          () => {
            console.error(
              `${new Date().toISOString()} QMD cutoff reached; stopping only refresh process tree`,
            )
            if (!child.pid) return
            if (cpu)
              spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
                windowsHide: true,
              })
            else process.kill(-child.pid, "SIGKILL")
          },
          Math.max(1, deadline - Date.now()),
        )
        child.on("error", error => {
          clearTimeout(timer)
          reject(error)
        })
        child.on("exit", (code, signal) => {
          clearTimeout(timer)
          if (code === 0) resolve()
          else reject(new Error(`qmd ${args[0]} exited ${code ?? signal}`))
        })
      })
    }
    console.log(`${new Date().toISOString()} QMD refresh completed`)
  } finally {
    unlinkSync(lock)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
