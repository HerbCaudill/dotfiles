/** Decide what the T3 watchdog should do after one health probe. */
export function watchdogDecision(
  /** The probe result and what the watchdog remembers. */
  args: WatchdogDecisionArgs,
): WatchdogDecision {
  const { now, probeOk, maintenanceRestarting } = args
  const restarts = args.state.restarts.filter(time => now - Date.parse(time) < RESTART_WINDOW_MS)
  const { failingSince } = args.state

  if (probeOk) {
    if (!failingSince) return { action: "none", state: args.state }
    const minutes = Math.round((now - Date.parse(failingSince)) / 60_000)
    return {
      action: "none",
      state: { restarts },
      message: `T3 answering again after ${minutes} min`,
    }
  }

  // The nightly maintenance restart stops T3 on purpose and brings it back after boot.
  if (maintenanceRestarting) return { action: "none", state: args.state }

  if (!failingSince)
    return {
      action: "none",
      state: { ...args.state, restarts, failingSince: new Date(now).toISOString() },
      message: "T3 not answering",
    }

  if (now - Date.parse(failingSince) < UNRESPONSIVE_MS) return { action: "none", state: args.state }

  if (restarts.length >= MAX_RESTARTS) {
    if (args.state.gaveUpAt) return { action: "none", state: args.state }
    return {
      action: "give-up",
      state: { ...args.state, restarts, gaveUpAt: new Date(now).toISOString() },
      message: `T3 is still not answering after ${restarts.length} watchdog restarts in ${RESTART_WINDOW_MS / 3_600_000} hours; no more restarts until it recovers`,
    }
  }

  return {
    action: "restart",
    state: { restarts: [...restarts, new Date(now).toISOString()] },
    message: `T3 has not answered for ${Math.round((now - Date.parse(failingSince)) / 60_000)} min; restarting it`,
  }
}

// CONSTANTS

// The Mac drops the mini within seconds, but T3 can be briefly slow under load; five minutes means it is stuck.
const UNRESPONSIVE_MS = 5 * 60_000

// More restarts than this in the window mean a restart isn't fixing the problem.
const MAX_RESTARTS = 3
const RESTART_WINDOW_MS = 3 * 3_600_000

// TYPES

/** Inputs to watchdogDecision. */
export type WatchdogDecisionArgs = {
  /** Current time in milliseconds. */
  now: number
  /** Whether the T3 server answered its health check. */
  probeOk: boolean
  /** What the watchdog remembers from earlier runs. */
  state: WatchdogState
  /** Whether the nightly maintenance restart is rebooting the mini, which stops T3 on purpose. */
  maintenanceRestarting: boolean
}

/** What the watchdog remembers between runs. */
export type WatchdogState = {
  /** When the current run of failed probes began. */
  failingSince?: string
  /** When the watchdog restarted T3 within the restart window. */
  restarts: string[]
  /** When the watchdog stopped restarting because restarts weren't helping. */
  gaveUpAt?: string
}

/** What to do now, the state to save, and a line to log if anything changed. */
export type WatchdogDecision = {
  /** `restart` restarts T3; `give-up` leaves a notice for Leo instead. */
  action: "none" | "restart" | "give-up"
  /** State to save. */
  state: WatchdogState
  /** Log line. */
  message?: string
}
