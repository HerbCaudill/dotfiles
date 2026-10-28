import { mkdir, open, readdir, unlink } from "node:fs/promises"
import { join } from "node:path"
import { createWatchSession } from "./createWatchSession.ts"
import { isRunning } from "./isRunning.ts"
import { getProcessIdentity } from "./getProcessIdentity.ts"
import { readWatchJson, watchHome } from "./watchStorage.ts"
import type { DaemonReceipt, WatchConfig } from "./types.ts"

/** Supervise all enrolled repositories, with one daemon and one stream per repository. */
export async function runWatchDaemon() {
  await mkdir(join(watchHome, "repositories"), { recursive: true, mode: 0o700 })
  const lockPath = join(watchHome, "daemon.json")
  const prior = await readWatchJson<DaemonReceipt>(lockPath)
  if (prior && isRunning(prior.pid, prior.identity))
    throw new Error(`Watcher daemon already running: ${prior.pid}`)
  if (prior) await unlink(lockPath)
  const identity = getProcessIdentity(process.pid)
  if (!identity) throw new Error("Cannot inspect the daemon process start identity")
  const lock = await open(lockPath, "wx", 0o600)
  await lock.writeFile(
    JSON.stringify({ pid: process.pid, identity, startedAt: new Date().toISOString() }),
  )
  await lock.close()
  const sessions = new Map<string, { config: string; stop: () => void }>()
  const errors = new Map<string, string>()
  let scanning = false
  let stopping = false

  /** Reconcile enrollment changes without reopening unchanged streams. */
  async function scan() {
    if (scanning || stopping) return
    scanning = true
    try {
      const directory = join(watchHome, "repositories")
      const files = (await readdir(directory)).filter(file => file.endsWith(".json"))
      for (const [file, session] of sessions) {
        if (!files.includes(file)) {
          session.stop()
          sessions.delete(file)
        }
      }
      for (const file of files) {
        try {
          const config = await readWatchJson<WatchConfig>(join(directory, file))
          if (!config) continue
          if (!config.repo || !config.thread) throw new Error("Invalid watch enrollment")
          const serialized = JSON.stringify(config)
          if (sessions.get(file)?.config === serialized) continue
          sessions.get(file)?.stop()
          sessions.delete(file)
          const stop = await createWatchSession(config)
          if (stopping) stop()
          else sessions.set(file, { config: serialized, stop })
          errors.delete(file)
        } catch (error) {
          const message = (error as Error).message
          if (errors.get(file) !== message) console.error(`[watch-beads] ${file}: ${message}`)
          errors.set(file, message)
        }
      }
    } finally {
      scanning = false
    }
  }

  /** Stop child streams and remove only this daemon's process receipt. */
  async function stop() {
    if (stopping) return
    stopping = true
    clearInterval(timer)
    for (const session of sessions.values()) session.stop()
    const receipt = await readWatchJson<DaemonReceipt>(lockPath)
    if (receipt?.pid === process.pid && receipt.identity === identity) await unlink(lockPath)
  }

  const timer = setInterval(
    () => void scan().catch(error => console.error(`[watch-beads] ${error.message}`)),
    2000,
  )
  process.once("SIGTERM", () => void stop())
  process.once("SIGINT", () => void stop())
  await scan()
}
