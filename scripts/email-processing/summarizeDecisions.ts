import type { DecisionLogEntry, GmailClient } from "./supervisorTypes.ts"

/**
 * Summarize the job's decisions since a time as Markdown, grouped by decision and classification.
 * Each thread is marked with where it is now, so log-only decisions can be compared with what Herb
 * did himself: a thread the job would archive that Herb has also archived is an agreement.
 */
export async function summarizeDecisions(
  /** Decisions and an optional Gmail reader for each thread's current place. */
  input: {
    /** Decision log in append order. */
    decisions: readonly DecisionLogEntry[]
    /** Start of the window. */
    since: Date
    /** Gmail reader; without it, current places are left out. */
    gmail?: Pick<GmailClient, "isThreadInInbox">
  },
): Promise<string> {
  const sinceIso = input.since.toISOString()
  const entries = latestPerThread(
    input.decisions.filter(
      entry => entry.timestamp >= sinceIso && DECISIONS.includes(entry.decision as never),
    ),
  )
  if (entries.length === 0) return `No decisions since ${formatTime(sinceIso)}.`

  const places = new Map<string, boolean | null>()
  if (input.gmail) {
    for (const entry of entries) {
      places.set(entry.threadId, await input.gmail.isThreadInInbox(entry.threadId))
    }
  }
  const agrees = (entry: DecisionLogEntry) => {
    const inInbox = places.get(entry.threadId)
    if (inInbox === undefined || inInbox === null) return null
    return entry.decision === "archive" ? !inInbox : inInbox
  }
  const counts = Object.fromEntries(
    DECISIONS.map(decision => [
      decision,
      entries.filter(entry => entry.decision === decision).length,
    ]),
  )
  const logOnly = entries.some(entry => entry.logOnly)
  const verb = (decision: string) => (logOnly ? WOULD[decision] : DID[decision])
  const compared = entries.filter(entry => agrees(entry) !== null)
  const agreed = compared.filter(entry => agrees(entry))

  const lines = [
    `## Email job since ${formatTime(sinceIso)}${logOnly ? " (log-only)" : ""}`,
    "",
    `${entries.length} threads: ${DECISIONS.map(decision => `${verb(decision)} ${counts[decision]}`).join(", ")}.`,
    ...(compared.length > 0
      ? [
          `Agrees with where Herb has left the thread for ${agreed.length} of ${compared.length}. A thread still in the inbox may just not have been read yet.`,
        ]
      : []),
  ]
  for (const decision of DECISIONS) {
    const group = entries.filter(entry => entry.decision === decision)
    if (group.length === 0) continue
    lines.push("", `### ${capitalize(verb(decision))} (${group.length})`)
    const byClassification = new Map<string, DecisionLogEntry[]>()
    for (const entry of group) {
      byClassification.set(entry.classification, [
        ...(byClassification.get(entry.classification) ?? []),
        entry,
      ])
    }
    for (const [classification, items] of [...byClassification].sort(
      (left, right) => right[1].length - left[1].length,
    )) {
      lines.push("", `**${classification}** (${items.length})`, "")
      for (const entry of items) {
        const inInbox = places.get(entry.threadId)
        const place =
          inInbox === undefined
            ? ""
            : inInbox === null
              ? " – gone"
              : inInbox
                ? " – in inbox"
                : " – archived"
        const mark = agrees(entry) === false ? " ⚠️" : ""
        lines.push(`- ${entry.sender} – ${entry.subject}${place}${mark}`)
      }
    }
  }
  return lines.join("\n")
}

/** Keep the newest decision for each thread. */
function latestPerThread(
  /** Decisions in append order. */
  entries: readonly DecisionLogEntry[],
): DecisionLogEntry[] {
  return [...new Map(entries.map(entry => [entry.threadId, entry])).values()]
}

/** Format an ISO time in Barcelona time, to the minute. */
function formatTime(
  /** ISO timestamp. */
  iso: string,
): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Madrid",
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/** Capitalize the first letter. */
function capitalize(
  /** Text. */
  value: string,
): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// CONSTANTS

const DECISIONS = ["archive", "promote", "none"] as const

const WOULD: Record<string, string> = {
  archive: "would archive",
  promote: "would promote",
  none: "would leave",
}

const DID: Record<string, string> = { archive: "archived", promote: "promoted", none: "left" }
