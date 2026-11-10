import type { JevDecision } from "./decideFromJevAnswers.ts"
import type { ClassifiedRecord } from "./renderJevDryRunReport.ts"

/** Collapse a decision into the single disposition Herb reviews. Unsubscribing always archives too. */
export function dispositionOf(
  /** Decision under the current rules. */
  decision: JevDecision,
): Disposition {
  if (decision.unsubscribe.eligible) return "unsubscribe"
  if (decision.decision === "archive") return "archive"
  if (decision.decision === "promote") return "promote"
  return "leave"
}

/** A store with no corrections yet. */
export function emptyCorrectionStore(): CorrectionStore {
  return { updatedAt: null, corrections: {} }
}

/** Apply Herb's corrections from the review page, returning a new store. */
export function applyCorrectionUpdates(
  /** Current store. */
  store: CorrectionStore,
  /** Updates from the page. */
  updates: CorrectionUpdate[],
  /** Classified dry-run records by message ID. */
  recordsById: ReadonlyMap<string, ClassifiedRecord>,
  /** Run name and clock. */
  context: { run: string; now: string },
): CorrectionStore {
  const corrections = { ...store.corrections }
  for (const update of updates) {
    const record = recordsById.get(update.messageId)
    if (!record) throw new Error(`Unknown message ${update.messageId}`)
    if (update.disposition === null) {
      delete corrections[update.messageId]
      continue
    }
    if (update.disposition !== undefined && !DISPOSITIONS.includes(update.disposition))
      throw new Error(`Unknown disposition ${String(update.disposition)}`)
    const existing = corrections[update.messageId]
    const jevDisposition = dispositionOf(record.decision)
    corrections[update.messageId] = {
      disposition: update.disposition ?? existing?.disposition ?? jevDisposition,
      note: update.note ?? existing?.note ?? "",
      jevDisposition,
      sender: record.sender,
      subject: record.subject,
      receivedAt: record.receivedAt,
      gmailUrl: record.gmailUrl,
      run: context.run,
      updatedAt: context.now,
    }
  }
  return { updatedAt: context.now, corrections }
}

// CONSTANTS

/** Dispositions Herb can choose, from least to most action. */
export const DISPOSITIONS: readonly Disposition[] = ["leave", "archive", "unsubscribe", "promote"]

// TYPES

/** What should happen to a thread. Unsubscribe means unsubscribe and archive. */
export type Disposition = "leave" | "archive" | "unsubscribe" | "promote"

/** Herb's disposition for one message, with what Jev said when he gave it. */
export type Correction = {
  /** Correct disposition. Equal to jevDisposition when Herb confirmed Jev's call. */
  disposition: Disposition
  /** Herb's optional explanation. */
  note: string
  /** Jev's disposition under the rules in force at the time. */
  jevDisposition: Disposition
  /** Sender. */
  sender: { name: string; address: string }
  /** Subject, with codes redacted. */
  subject: string
  /** Receipt time. */
  receivedAt: string
  /** Gmail link. */
  gmailUrl: string
  /** Dry run the correction was made in. */
  run: string
  /** When Herb last changed it. */
  updatedAt: string
}

/** All corrections, keyed by Gmail message ID so they carry across dry runs. */
export type CorrectionStore = {
  /** Last change. */
  updatedAt: string | null
  /** Corrections by message ID. */
  corrections: Record<string, Correction>
}

/** One change from the review page. A null disposition removes the correction. */
export type CorrectionUpdate = {
  /** Gmail message ID. */
  messageId: string
  /** New disposition, null to clear, or omitted to keep the current one. */
  disposition?: Disposition | null
  /** New note, or omitted to keep the current one. */
  note?: string
}
