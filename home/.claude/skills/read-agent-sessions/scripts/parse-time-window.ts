import type { TimeWindow } from "./types.ts"

/** Parse CLI date options using the process's current local timezone. */
export function parseTimeWindow(
  /** Calendar-day expression from `--on`. */
  on: string | undefined,
  /** Inclusive timestamp expression from `--since`. */
  since: string | undefined,
  /** Exclusive timestamp expression from `--until`. */
  until: string | undefined,
  /** Current time, injectable for deterministic relative-date tests. */
  now = new Date(),
): TimeWindow | undefined {
  if (on && (since || until)) throw new Error("--on cannot be combined with --since or --until")

  if (on) {
    const start = parseCalendarDay(on, now)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    return {
      since: start,
      until: end,
      label: formatLocalDate(start),
    }
  }

  if (!since && !until) return undefined

  const start = since ? parseDateTime(since, "--since") : undefined
  const end = until ? parseDateTime(until, "--until") : undefined
  if (start && end && start >= end) throw new Error("--until must be later than --since")

  return {
    since: start,
    until: end,
    label: `${start ? formatLocalDateTime(start) : "the beginning"} to ${end ? formatLocalDateTime(end) : "now"}`,
  }
}

/** Parse a named or ISO-shaped calendar day in local time. */
function parseCalendarDay(value: string, now: Date) {
  if (value === "today" || value === "yesterday") {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    if (value === "yesterday") date.setDate(date.getDate() - 1)
    return date
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('--on requires "today", "yesterday", or YYYY-MM-DD')

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (formatLocalDate(date) !== value) throw new Error(`Invalid calendar day "${value}"`)
  return date
}

/** Parse an ISO date or date-time, interpreting offset-free values in local time. */
function parseDateTime(value: string, option: "--since" | "--until") {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseCalendarDay(value, new Date())
    : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${option} requires a valid date or date-time`)
  return date
}

/** Format a local calendar day without locale-dependent ordering. */
export function formatLocalDate(
  /** Date to format. */
  date: Date,
) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Format a local timestamp without locale-dependent ordering. */
export function formatLocalDateTime(
  /** Date to format. */
  date: Date,
) {
  return `${formatLocalDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Pad a date component to two digits. */
function pad(value: number) {
  return String(value).padStart(2, "0")
}
