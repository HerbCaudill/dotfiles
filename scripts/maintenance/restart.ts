/*
Mini maintenance restart. `prepare` runs nightly at 02:00: it checks AMD for a newer Adrenalin release, then, once the mini
has been up for about three days, pauses running T3 agent sessions, waits for jobs, builds and tests to finish, and
restarts. `resume` runs at startup: it restores the desktop tasks that don't start themselves and tells the paused
sessions to continue. `dry-run` reports what `prepare` would do without changing anything.
*/
import { spawnSync } from "node:child_process"
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir, uptime } from "node:os"
import { dirname, join, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath, pathToFileURL } from "node:url"

import { amdReleaseCandidates } from "./amdReleaseCandidates.ts"
import { parseQuser } from "./parseQuser.ts"
import { restartBlocker } from "./restartBlocker.ts"

/** Check for a driver release, then pause sessions and restart the mini when a restart is due. */
export async function prepare(
  /** Report only: send no messages, change no tasks and don't restart. */
  dryRun = false,
): Promise<void> {
  const state = readState()
  await checkAmdRelease(state, dryRun)

  const hour = new Date().getHours()
  if (!dryRun && (hour < 1 || hour >= 5))
    return log(`No restart: ${hour}:00 is outside the 01:00 to 05:00 maintenance window`)
  const blocker = restartBlocker({
    uptimeHours: uptime() / 3600,
    sessions: parseQuser(run("quser.exe", []).output),
  })
  if (blocker) log(`No restart tonight: ${blocker}`)
  if (blocker && !dryRun) return

  if (dryRun) {
    log(`Would pause: ${describeThreads(activeThreads())}`)
    log(`Would wait for tasks: ${runningJobTasks().join(", ") || "none"}`)
    log(`Would wait for processes: ${buildProcesses().join(", ") || "none"}`)
    return
  }

  // The heartbeat restarts sessions that look stalled, which would undo the pause.
  setTaskEnabled(HEARTBEAT_TASK, false)
  saveState({ ...state, phase: "pausing", pausedThreadIds: [], heartbeatDisabled: true })
  const paused = new Set<string>()
  const deadline = Date.now() + WAIT_MS
  try {
    while (true) {
      const threads = activeThreads()
      for (const thread of threads.filter(thread => !paused.has(thread.threadId))) {
        sendToThread(thread.threadId, PAUSE_PROMPT)
        paused.add(thread.threadId)
        log(`Asked to pause: ${thread.title} (${thread.threadId})`)
      }
      saveState({ ...readState(), pausedThreadIds: [...paused] })
      const tasks = runningJobTasks()
      const processes = buildProcesses()
      if (!threads.length && !tasks.length && !processes.length) break
      if (Date.now() > deadline) {
        const waiting = [describeThreads(threads), ...tasks, ...processes].filter(Boolean)
        throw new DeferError(`still busy after ${WAIT_MS / 60_000} min: ${waiting.join(", ")}`)
      }
      await sleep(POLL_MS)
    }
  } catch (error) {
    const reason = error instanceof DeferError ? error.message : String(error)
    log(`Restart deferred to the next night: ${reason}`)
    notice(`Maintenance restart deferred: ${reason}`)
    for (const threadId of paused) sendToThread(threadId, RESUME_PROMPT)
    setTaskEnabled(HEARTBEAT_TASK, true)
    saveState({ ...readState(), phase: "idle", pausedThreadIds: [], heartbeatDisabled: false })
    return
  }

  const reason = `Mini maintenance: scheduled restart every 3 days to clear the AMD graphics driver's kernel pool leak. Paused ${paused.size} agent session(s); no jobs, builds or tests running.`
  appendFileSync(REBOOTS_LOG, `${new Date().toISOString()} ${reason}\n`)
  saveState({ ...readState(), phase: "restarting", restartRequestedAt: new Date().toISOString() })
  log(`Restarting: ${reason}`)
  run("shutdown.exe", ["/r", "/t", "60", "/d", "p:4:1", "/c", reason])
}

/** After a maintenance restart, restore desktop tasks and tell paused sessions to continue. */
export async function resume(): Promise<void> {
  const state = readState()
  if (state.phase !== "restarting") {
    if (state.heartbeatDisabled) setTaskEnabled(HEARTBEAT_TASK, true)
    return log("Startup: no maintenance restart pending")
  }
  log(`Startup after maintenance restart; driver ${driverVersion()}`)
  await waitForT3()
  const running = new Set(runningTaskNames())
  for (const task of RESTORE_TASKS.filter(task => !running.has(task))) {
    const result = run("schtasks.exe", ["/Run", "/TN", task])
    log(`Started ${task}: ${result.ok ? "ok" : result.output.trim()}`)
  }
  for (const threadId of state.pausedThreadIds) {
    sendToThread(threadId, RESUME_PROMPT)
    log(`Asked to continue: ${threadId}`)
  }
  setTaskEnabled(HEARTBEAT_TASK, true)
  saveState({ ...state, phase: "idle", pausedThreadIds: [], heartbeatDisabled: false })
}

// HELPERS

/** Look for Adrenalin releases newer than the last one seen and leave a notice for Leo. */
async function checkAmdRelease(
  /** Current state, which records the newest release seen. */
  state: MaintenanceState,
  /** Report only: don't save the release or leave a notice. */
  dryRun: boolean,
): Promise<void> {
  const known = state.latestAmdRelease ?? INITIAL_AMD_RELEASE
  try {
    const found: { version: string; url: string; text: string }[] = []
    for (const version of amdReleaseCandidates(known)) {
      const url = AMD_RELEASE_NOTES(version)
      const response = await fetch(url, { headers: { "User-Agent": BROWSER_USER_AGENT } })
      if (response.status === 404) continue
      if (!response.ok) throw new Error(`${url} returned ${response.status}`)
      found.push({ version, url, text: await response.text() })
    }
    const newest = found.at(-1)
    if (!newest) return log(`AMD: nothing newer than ${known}`)
    const mentions = leakMentions(newest.text)
    const message = `AMD Adrenalin ${newest.version} is out: ${newest.url}. ${
      mentions.length
        ? `Its release notes mention: ${mentions.join(" | ")}`
        : "Its release notes don't mention the leak."
    }`
    log(message)
    if (dryRun) return
    notice(message)
    saveState({ ...readState(), latestAmdRelease: newest.version })
  } catch (error) {
    log(`AMD check failed: ${error}`)
  }
}

/** Pull release-note sentences that may describe the kernel pool leak. */
function leakMentions(
  /** Release notes HTML. */
  html: string,
): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => LEAK_PATTERN.test(line))
    .slice(0, 5)
    .map(line => line.slice(0, 200))
}

/** List T3 threads on this machine that are working or about to. */
function activeThreads(): T3Thread[] {
  const database = new DatabaseSync(join(homedir(), ".t3/userdata/statev2.sqlite"), {
    readOnly: true,
  })
  const projectIds = (() => {
    try {
      return database
        .prepare("select project_id from projection_projects where deleted_at is null")
        .all()
        .map(row => String(row.project_id))
    } finally {
      database.close()
    }
  })()
  return projectIds
    .flatMap(projectId => {
      const result = t3(["thread", "list", "--project", projectId, "--json"])
      // An unreadable project could hide a running session, so treat it as a failure, not as idle.
      if (!result.ok) throw new Error(`t3 thread list failed: ${result.output.trim()}`)
      return JSON.parse(result.stdout) as T3Thread[]
    })
    .filter(thread => ACTIVE_STATUSES.includes(thread.status))
}

/** Name threads for the log. */
function describeThreads(
  /** Threads to name. */
  threads: T3Thread[],
): string {
  return threads.map(thread => `${thread.title} (${thread.status})`).join(", ")
}

/** Send a prompt file's text to a thread as its next turn. */
function sendToThread(
  /** Thread id. */
  threadId: string,
  /** Message text. */
  message: string,
): void {
  const result = t3(["thread", "send", threadId, "-"], message)
  if (!result.ok) log(`Could not message ${threadId}: ${result.output.trim()}`)
}

/** Wait for the T3 server to answer after boot. */
async function waitForT3(): Promise<void> {
  const deadline = Date.now() + T3_STARTUP_MS
  while (Date.now() < deadline) {
    try {
      activeThreads()
      return
    } catch {
      await sleep(30_000)
    }
  }
  log("T3 did not answer within 15 minutes; messaging anyway")
}

/** List running root scheduled tasks that are jobs rather than long-running services. */
function runningJobTasks(): string[] {
  return runningTaskNames().filter(
    name => !SERVICE_TASKS.includes(name) && !SERVICE_TASK_PATTERNS.some(p => p.test(name)),
  )
}

/** List running root scheduled tasks. */
function runningTaskNames(): string[] {
  return run("schtasks.exe", ["/Query", "/FO", "CSV", "/NH"])
    .output.split(/\r?\n/)
    .map(line => /^"\\([^\\"]+)","[^"]*","Running"/.exec(line)?.[1])
    .filter(name => name !== undefined)
}

/** List build and test processes, which a restart would kill mid-run. */
function buildProcesses(): string[] {
  const script = `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and ($_.Name -match '${BUILD_PROCESS_PATTERN}' -or $_.CommandLine -match '${BUILD_COMMAND_PATTERN}') -and $_.CommandLine -notmatch 'Get-CimInstance' } | ForEach-Object { "$($_.Name) $($_.ProcessId)" }`
  return run("pwsh.exe", ["-NoProfile", "-Command", script]).stdout.split(/\r?\n/).filter(Boolean)
}

/** Read the AMD display driver version, for the log. */
function driverVersion(): string {
  return run("pwsh.exe", [
    "-NoProfile",
    "-Command",
    "(Get-CimInstance Win32_VideoController | Where-Object Name -match 'Radeon').DriverVersion",
  ]).stdout.trim()
}

/** Enable or disable a scheduled task. */
function setTaskEnabled(
  /** Task name. */
  name: string,
  /** Whether it should run. */
  enabled: boolean,
): void {
  const result = run("schtasks.exe", ["/Change", "/TN", name, enabled ? "/ENABLE" : "/DISABLE"])
  log(`${enabled ? "Enabled" : "Disabled"} ${name}: ${result.ok ? "ok" : result.output.trim()}`)
}

/** Run the t3 CLI through cmd.exe, which batch files require. */
function t3(
  /** CLI arguments. */
  args: string[],
  /** Optional stdin text. */
  input?: string,
): RunResult {
  return run(
    "cmd.exe",
    ["/d", "/c", join(homedir(), ".t3/bin/t3.cmd"), ...args, "--log-level", "error"],
    input,
  )
}

/** Run a command and capture its output. */
function run(
  /** Executable. */
  command: string,
  /** Arguments. */
  args: string[],
  /** Optional stdin text. */
  input?: string,
): RunResult {
  const result = spawnSync(command, args, { input, encoding: "utf8", windowsHide: true })
  const stdout = result.stdout ?? ""
  return { ok: result.status === 0, stdout, output: stdout + (result.stderr ?? "") }
}

/** Read the maintenance state, or a fresh one. */
function readState(): MaintenanceState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as MaintenanceState
  } catch {
    return { phase: "idle", pausedThreadIds: [], heartbeatDisabled: false }
  }
}

/** Write the maintenance state. */
function saveState(
  /** New state. */
  state: MaintenanceState,
): void {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
  )
}

/** Leave a dated line for Leo's heartbeat to report. */
function notice(
  /** What Herb should hear about. */
  message: string,
): void {
  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(NOTICES_FILE, `- ${new Date().toISOString()} ${message}\n`)
}

/** Write a timestamped log line; the wrapper sends stdout to maintenance.log. */
function log(
  /** Log text. */
  message: string,
): void {
  console.log(`${new Date().toISOString()} ${message}`)
}

/** Wait. */
function sleep(
  /** Milliseconds. */
  ms: number,
): Promise<void> {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms))
}

// CONSTANTS

const HERE = dirname(fileURLToPath(import.meta.url))
const PAUSE_PROMPT = readFileSync(join(HERE, "pause.prompt.md"), "utf8")
const RESUME_PROMPT = readFileSync(join(HERE, "resume.prompt.md"), "utf8")

const STATE_DIR = join(homedir(), ".local/state/mini-maintenance")
const STATE_FILE = join(STATE_DIR, "state.json")
const NOTICES_FILE = join(STATE_DIR, "notices.md")
const REBOOTS_LOG = "C:\\ProgramData\\agent-access\\reboots.log"

// Installed on 2026-11-09; 26.10.2 was already out and is known to leak.
const INITIAL_AMD_RELEASE = "26.10.2"
const AMD_RELEASE_NOTES = (version: string) =>
  `https://www.amd.com/en/resources/support-articles/release-notes/RN-RAD-WIN-${version.replaceAll(".", "-")}.html`
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
const LEAK_PATTERN = /amdkmdag|non-?paged|memory leak|kernel pool|process (start|creation)/i

const HEARTBEAT_TASK = "Leo heartbeat"
const ACTIVE_STATUSES = ["running", "starting", "preparing", "queued"]
const WAIT_MS = 45 * 60_000
const POLL_MS = 60_000
const T3_STARTUP_MS = 15 * 60_000

// Long-running services and desktop apps; a restart stops them and they come back afterward.
const SERVICE_TASKS = [
  "Agent Chrome",
  "Chrome desktop",
  "DevResults e2e coverage report",
  "DevResults site",
  "drenv mini controller",
  "mini-maintenance-restart",
  "mini-maintenance-resume",
  "Obsidian desktop",
  "qmd-refresh",
  "Signal desktop",
  "T3 desktop",
  "tasks-agent",
  "VibeResults dev",
]
const SERVICE_TASK_PATTERNS = [/^drenv-watch-/]

// Tasks with no startup trigger that were restarted by hand after earlier restarts.
const RESTORE_TASKS = ["VibeResults dev", "Obsidian desktop"]

const BUILD_PROCESS_PATTERN = "^(MSBuild|VSTest\\.Console|testhost|vstest\\.console)(\\.exe)?$"
const BUILD_COMMAND_PATTERN = "playwright|vitest|vstest"

// TYPES

/** Persisted between the nightly run and the startup run. */
type MaintenanceState = {
  /** Where the maintenance cycle is. */
  phase: "idle" | "pausing" | "restarting"
  /** Threads asked to pause, to resume after startup. */
  pausedThreadIds: string[]
  /** Whether the heartbeat was disabled and needs enabling again. */
  heartbeatDisabled: boolean
  /** Newest AMD Adrenalin release seen, such as "26.10.2". */
  latestAmdRelease?: string
  /** When the restart was requested. */
  restartRequestedAt?: string
  /** Last write. */
  updatedAt?: string
}

/** The fields this script reads from `t3 thread list --json`. */
type T3Thread = {
  /** Thread id. */
  threadId: string
  /** Thread title. */
  title: string
  /** Run status. */
  status: string
}

/** Captured command result. */
type RunResult = {
  /** Exit code 0. */
  ok: boolean
  /** Standard output. */
  stdout: string
  /** Standard output and error together. */
  output: string
}

/** The restart should wait for another night. */
class DeferError extends Error {}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const command = process.argv[2]
  const action =
    command === "prepare"
      ? prepare()
      : command === "resume"
        ? resume()
        : command === "dry-run"
          ? prepare(true)
          : Promise.reject(new Error("Usage: restart.ts prepare | resume | dry-run"))
  action.catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
