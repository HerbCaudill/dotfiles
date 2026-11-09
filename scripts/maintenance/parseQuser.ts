/** Read the sessions that `quser.exe` lists, with how long each has been idle. */
export function parseQuser(
  /** Raw `quser.exe` output. */
  output: string,
): QuserSession[] {
  return output
    .split(/\r?\n/)
    .map(line => SESSION_LINE.exec(line))
    .filter(match => match !== null)
    .map(([, user, state, idle]) => ({
      user,
      state: state as QuserSession["state"],
      idleMinutes: idleMinutes(idle),
    }))
}

/** Convert quser's idle column ("." , "12", "3:46" or "2+03:04") to minutes. */
function idleMinutes(
  /** The idle column. */
  idle: string,
): number {
  const match = /^(?:(\d+)\+)?(?:(\d+):)?(\d+)$/.exec(idle)
  if (!match) return 0
  const [, days = "0", hours = "0", minutes] = match
  return (Number(days) * 24 + Number(hours)) * 60 + Number(minutes)
}

// CONSTANTS

// Disconnected sessions have no session name, so match from both ends rather than by column.
const SESSION_LINE = /^[ >](\S+)\s+(?:\S+\s+)?\d+\s+(Active|Disc)\s+(\S+)\s+\S+/

// TYPES

/** One Windows sign-in session. */
export type QuserSession = {
  /** Account name. */
  user: string
  /** Whether a Remote Desktop client is connected. */
  state: "Active" | "Disc"
  /** Minutes since the last input. */
  idleMinutes: number
}
