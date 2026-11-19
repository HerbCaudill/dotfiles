/*
T3 watchdog for the mini. A scheduled task runs this every minute. It asks the local T3 server for its environment
descriptor, and when the server has not answered for five minutes it restarts the `T3 desktop` task, which brings the
server back. The Mac's link to the mini goes through that server, so a hung server shows on the Mac as a disconnected
mini. Log: ~/.local/state/t3-watchdog/watchdog.log. Only changes are logged, so a healthy server writes nothing.
*/
import { spawnSync } from "node:child_process"
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { isMainModule } from "../isMainModule.ts"
import { watchdogDecision, type WatchdogState } from "./watchdogDecision.ts"

/** Probe T3 once and act on the result. */
export async function check(): Promise<void> {
  const decision = watchdogDecision({
    now: Date.now(),
    probeOk: await probe(),
    state: readState(),
    maintenanceRestarting: maintenanceRestarting(),
  })
  saveState(decision.state)
  if (decision.message) log(decision.message)
  if (decision.action === "give-up") notice(decision.message ?? "T3 watchdog gave up")
  if (decision.action === "restart") await restartT3()
}

// HELPERS

/** Ask the T3 server for its environment descriptor, which the Mac also requests when it connects. */
async function probe(): Promise<boolean> {
  try {
    const response = await fetch(PROBE_URL, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return response.ok
  } catch {
    return false
  }
}

/** Log what the hung server was doing, then end the desktop task and start it again. */
async function restartT3(): Promise<void> {
  log(`Before restart: ${powershell(DIAGNOSTICS_SCRIPT).replace(/\s+/g, " ").trim()}`)
  run("schtasks.exe", ["/End", "/TN", T3_TASK])
  await sleep(5_000)
  // Ending the task can leave the server process behind, still holding the port.
  powershell("Get-Process -Name 'T3 Code*' -ErrorAction SilentlyContinue | Stop-Process -Force")
  await sleep(3_000)
  const started = run("schtasks.exe", ["/Run", "/TN", T3_TASK])
  if (!started.ok) return log(`Could not start ${T3_TASK}: ${started.output.trim()}`)
  const deadline = Date.now() + STARTUP_MS
  while (Date.now() < deadline) {
    await sleep(5_000)
    if (await probe()) return log("T3 restarted and answering")
  }
  log(`T3 restarted but not answering after ${STARTUP_MS / 60_000} min`)
}

/** Whether the nightly maintenance job is rebooting the mini. */
function maintenanceRestarting(): boolean {
  try {
    const state = JSON.parse(readFileSync(MAINTENANCE_STATE_FILE, "utf8")) as {
      phase?: string
      restartRequestedAt?: string
    }
    // A stale phase from a restart that never resumed shouldn't silence the watchdog for good.
    return (
      state.phase === "restarting" &&
      Date.now() - Date.parse(state.restartRequestedAt ?? "") < MAINTENANCE_RESTART_MS
    )
  } catch {
    return false
  }
}

/** Run a PowerShell command and return its output. */
function powershell(
  /** Script text. */
  script: string,
): string {
  return run("pwsh.exe", ["-NoProfile", "-Command", script]).output
}

/** Run a command and capture its output. */
function run(
  /** Executable. */
  command: string,
  /** Arguments. */
  args: string[],
): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true })
  return { ok: result.status === 0, output: (result.stdout ?? "") + (result.stderr ?? "") }
}

/** Read the watchdog state, or a fresh one. */
function readState(): WatchdogState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as WatchdogState
  } catch {
    return { restarts: [] }
  }
}

/** Write the watchdog state. */
function saveState(
  /** New state. */
  state: WatchdogState,
): void {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

/** Leave a dated line in the maintenance notices, where Leo looks for mini problems. */
function notice(
  /** What Herb should hear about. */
  message: string,
): void {
  appendFileSync(NOTICES_FILE, `- ${new Date().toISOString()} ${message}\n`)
}

/** Write a timestamped log line; the wrapper sends stdout to watchdog.log. */
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
  return new Promise(resolve => setTimeout(resolve, ms))
}

// CONSTANTS

const PROBE_URL = "http://127.0.0.1:3773/.well-known/t3/environment"
const PROBE_TIMEOUT_MS = 15_000
const STARTUP_MS = 2 * 60_000
const T3_TASK = "T3 desktop"

// Shutdown, boot and the resume job's wait for T3 fit well inside this.
const MAINTENANCE_RESTART_MS = 45 * 60_000

const STATE_DIR = join(homedir(), ".local/state/t3-watchdog")
const STATE_FILE = join(STATE_DIR, "state.json")
const MAINTENANCE_STATE_FILE = join(homedir(), ".local/state/mini-maintenance/state.json")
const NOTICES_FILE = join(homedir(), ".local/state/mini-maintenance/notices.md")

// Enough to tell a stuck thread pool (threads in Executive waits, trace log gone quiet) from memory pressure.
const DIAGNOSTICS_SCRIPT = `
$id = (Get-NetTCPConnection -LocalPort 3773 -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
$threads = if ($id) { ((Get-Process -Id $id).Threads | Group-Object WaitReason | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ',' } else { 'no listener' }
$trace = (Get-Item "$env:USERPROFILE\\.t3\\userdata\\logs\\server.trace.ndjson" -ErrorAction SilentlyContinue).LastWriteTime
$os = Get-CimInstance Win32_OperatingSystem
$pool = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).PoolNonpagedBytes
"server pid $id; thread waits $threads; trace last written $trace; free RAM $([math]::Round($os.FreePhysicalMemory / 1KB)) MB; nonpaged pool $([math]::Round($pool / 1MB)) MB"
`

if (isMainModule(import.meta.url))
  check().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
