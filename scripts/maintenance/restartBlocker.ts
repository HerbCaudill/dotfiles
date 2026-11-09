import type { QuserSession } from "./parseQuser.ts"

/** Say why tonight's maintenance restart should wait, or return null when it can go ahead. */
export function restartBlocker(
  /** The machine's current state. */
  args: RestartBlockerArgs,
): string | null {
  if (args.uptimeHours < MIN_UPTIME_HOURS)
    return `uptime ${args.uptimeHours.toFixed(1)} h is under ${MIN_UPTIME_HOURS} h`
  const user = args.sessions.find(
    session => session.state === "Active" && session.idleMinutes < ACTIVE_IDLE_MINUTES,
  )
  if (user) return `${user.user} is using the desktop (idle ${user.idleMinutes} min)`
  return null
}

// CONSTANTS

// The job runs nightly; this makes it restart every third night and retry the next night after a deferral.
const MIN_UPTIME_HOURS = 60

// A connected Remote Desktop session this recently used means someone is at the mini.
const ACTIVE_IDLE_MINUTES = 30

// TYPES

/** Inputs to restartBlocker. */
export type RestartBlockerArgs = {
  /** Hours since boot. */
  uptimeHours: number
  /** Signed-in sessions from quser. */
  sessions: QuserSession[]
}
