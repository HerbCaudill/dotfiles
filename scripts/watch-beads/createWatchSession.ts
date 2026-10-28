import { spawn, type ChildProcess } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createInterface } from "node:readline"
import { reconcileWatch } from "./reconcileWatch.ts"
import { runWatchCommand } from "./runWatchCommand.ts"
import { readWatchJson, watchPaths, writeWatchJson } from "./watchStorage.ts"
import type { ReadyIssue, WatchConfig, WatchState } from "./types.ts"

/** Follow event hints and reconcile readiness without keeping an agent turn alive. */
export async function createWatchSession(
  /** Explicitly enrolled repository and recipient. */
  config: WatchConfig,
) {
  const controller = new AbortController()
  const { signal } = controller
  const statePath = watchPaths(config.repo).state
  const saved = await readWatchJson<WatchState>(statePath)
  let state: WatchState = saved?.thread === config.thread ? saved : { thread: config.thread }
  let eventProcess: ChildProcess | undefined
  let debounce: NodeJS.Timeout | undefined
  let reconnect: NodeJS.Timeout | undefined
  let running = false
  let dirty = false
  let eventError: string | undefined
  const prompt = await readFile(new URL("./watch-beads-wake.prompt.md", import.meta.url), "utf8")

  /** Coalesce a burst of mutations; never overlap checks for this repository. */
  function requestCheck() {
    if (signal.aborted) return
    dirty = true
    if (running || debounce) return
    debounce = setTimeout(() => {
      debounce = undefined
      void check()
    }, 1500)
  }

  /** Re-read authoritative readiness, persisting delivery state only after acceptance. */
  async function check() {
    if (signal.aborted || running) return
    running = true
    dirty = false
    try {
      const [readyJson, activeJson] = await Promise.all([
        runWatchCommand("bd", ["ready", "--json", "--limit", "0"], config.repo, undefined, signal),
        runWatchCommand(
          "bd",
          ["list", "--status", "in_progress", "--json", "--limit", "0"],
          config.repo,
          undefined,
          signal,
        ),
      ])
      const ready = JSON.parse(readyJson) as ReadyIssue[]
      const active = (JSON.parse(activeJson) as ReadyIssue[]).map(issue => issue.id)
      const snapshot = await reconcileWatch(state.snapshot, ready, active, async ids => {
        if (signal.aborted) throw new Error("Watch stopped")
        const message = prompt
          .replace("{{repo}}", JSON.stringify(config.repo))
          .replace("{{ids}}", JSON.stringify(ids))
        await runWatchCommand(
          "t3",
          [
            "--log-level",
            "error",
            "thread",
            "send",
            config.thread,
            "-",
            "--json",
            ...(config.t3Home ? ["--base-dir", config.t3Home] : []),
          ],
          config.repo,
          message,
          signal,
        )
        state.lastWake = new Date().toISOString()
        console.log(`[watch-beads] Woke ${config.thread} for ${ids.join(", ")}`)
      })
      state = { ...state, snapshot, lastCheck: new Date().toISOString(), lastError: eventError }
    } catch (error) {
      if (signal.aborted) return
      const message = (error as Error).message
      if (state.lastError !== message) console.error(`[watch-beads] ${config.repo}: ${message}`)
      state = { ...state, lastCheck: new Date().toISOString(), lastError: message }
    } finally {
      running = false
      if (!signal.aborted) {
        await writeWatchJson(statePath, state)
        if (dirty) requestCheck()
      }
    }
  }

  /** Start at the current journal head and reconcile fully to cover downtime and pruning. */
  async function connectEvents() {
    try {
      const rows = JSON.parse(
        await runWatchCommand(
          "bd",
          [
            "sql",
            "--readonly",
            "--json",
            "SELECT COALESCE(MAX(seq), 0) AS head FROM bd_events_journal",
          ],
          config.repo,
          undefined,
          signal,
        ),
      ) as { head: number }[]
      if (signal.aborted) return
      const child = spawn(
        "bd",
        ["events", "tail", "--follow", "--since", String(rows[0]?.head ?? 0), "--json"],
        { cwd: config.repo, stdio: ["ignore", "pipe", "pipe"] },
      )
      eventProcess = child
      let stderr = ""
      child.stderr.on("data", chunk => {
        stderr = (stderr + chunk).slice(-1000)
      })
      const lines = createInterface({ input: child.stdout })
      lines.on("line", requestCheck)
      child.on("error", error => {
        stderr = error.message
      })
      child.on("close", () => {
        lines.close()
        if (!signal.aborted) {
          eventError = `Event stream disconnected; retrying. ${stderr}`
          requestCheck()
          reconnect = setTimeout(() => void connectEvents(), 5000)
        }
      })
      eventError = undefined
      requestCheck()
    } catch (error) {
      if (signal.aborted) return
      eventError = `Event stream unavailable; retrying. ${(error as Error).message}`
      requestCheck()
      reconnect = setTimeout(() => void connectEvents(), 5000)
    }
  }

  // Synced changes, journal bypasses and time-based deferrals may emit no local event.
  const reconciliation = setInterval(requestCheck, 60_000)
  requestCheck()
  void connectEvents()
  return () => {
    controller.abort()
    clearInterval(reconciliation)
    clearTimeout(debounce)
    clearTimeout(reconnect)
    eventProcess?.kill()
  }
}
