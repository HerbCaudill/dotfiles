import { appendFile, chmod, mkdir, readFile, rename, truncate, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

import { sanitizeDecisionLogEntry } from "./sanitizeDecisionLogEntry.ts"
import type { DecisionLogEntry, EmailProcessingState } from "./supervisorTypes.ts"

/** Load durable supervisor state or an empty first-run state. */
export async function loadEmailProcessingState(
  /** State path, injectable for tests. */
  path = defaultStatePath(),
): Promise<EmailProcessingState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown
    return normalizeState(parsed)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState()
    throw error
  }
}

/** Atomically save normalized supervisor state with owner-only permissions. */
export async function saveEmailProcessingState(
  /** State to persist. */
  state: EmailProcessingState,
  /** State path, injectable for tests. */
  path = defaultStatePath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(normalizeState(state), null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  await rename(temporaryPath, path)
  await chmod(path, 0o600)
}

/** Load complete JSONL decisions while tolerating an interrupted final append. */
export async function loadEmailDecisionLog(
  /** Decision-log path, injectable for tests. */
  path = defaultDecisionLogPath(),
): Promise<DecisionLogEntry[]> {
  try {
    const contents = await readFile(path, "utf8")
    const lines = contents.split("\n")
    return lines.flatMap((line, index) => {
      if (!line.trim()) return []
      try {
        return [parseDecisionLogEntry(JSON.parse(line) as unknown)]
      } catch (error) {
        const isTruncatedFinalLine = index === lines.length - 1 && !contents.endsWith("\n")
        if (isTruncatedFinalLine) return []
        throw error
      }
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

/** Append one sanitized outcome or raw error diagnostic with owner-only permissions. */
export async function appendEmailDecision(
  /** Decision record to sanitize and persist. */
  entry: DecisionLogEntry,
  /** Decision-log path, injectable for tests. */
  path = defaultDecisionLogPath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await repairJsonlTail(path)
  await appendFile(path, `${JSON.stringify(sanitizeDecisionLogEntry(entry))}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  await chmod(path, 0o600)
}

/** Remove only an incomplete final JSONL fragment before the next append. */
async function repairJsonlTail(
  /** Decision-log path. */
  path: string,
): Promise<void> {
  let contents: Buffer
  try {
    contents = await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  if (contents.length === 0 || contents.at(-1) === NEWLINE_BYTE) return

  const tailStart = contents.lastIndexOf(NEWLINE_BYTE) + 1
  try {
    parseDecisionLogEntry(JSON.parse(contents.subarray(tailStart).toString("utf8")) as unknown)
    await appendFile(path, "\n", { encoding: "utf8", mode: 0o600 })
  } catch {
    await truncate(path, tailStart)
  }
}

/** Normalize persisted state without retaining unknown fields. */
function normalizeState(
  /** Unknown decoded JSON value. */
  value: unknown,
): EmailProcessingState {
  if (!isRecord(value)) return emptyState()
  const retryMessageIds = stringArray(value.retryMessageIds)
  const retryOriginalLabelIds = stringArrayRecord(value.retryOriginalLabelIds)
  const archiveReversalSenders = stringArray(value.archiveReversalSenders).map(address =>
    address.toLowerCase(),
  )
  const state: EmailProcessingState = {
    lastHistoryId: nullableString(value.lastHistoryId),
    lastCompletedAt: nullableString(value.lastCompletedAt),
    retryMessageIds: [...new Set(retryMessageIds)],
    archiveReversalSenders: [...new Set(archiveReversalSenders)].sort(),
  }
  const retainedRetryLabels = Object.fromEntries(
    Object.entries(retryOriginalLabelIds).filter(([messageId]) =>
      state.retryMessageIds.includes(messageId),
    ),
  )
  return Object.keys(retainedRetryLabels).length > 0
    ? { ...state, retryOriginalLabelIds: retainedRetryLabels }
    : state
}

/** Parse a complete decision record without admitting body-like unknown fields. */
function parseDecisionLogEntry(
  /** Unknown decoded JSONL record. */
  value: unknown,
): DecisionLogEntry {
  if (!isRecord(value)) throw new Error("Invalid email decision log entry")
  const decision = value.decision
  const confidence = value.confidence
  if (!DECISIONS.has(decision as never) || !CONFIDENCE_LEVELS.has(confidence as never)) {
    throw new Error("Invalid email decision log entry")
  }
  const exception = decision === "error" ? optionalString(value.exception) : undefined
  return {
    timestamp: requiredString(value.timestamp),
    messageId: requiredString(value.messageId),
    threadId: requiredString(value.threadId),
    sender: requiredString(value.sender),
    subject: requiredString(value.subject),
    originalLabels: stringArray(value.originalLabels),
    decision: decision as DecisionLogEntry["decision"],
    classification: requiredString(value.classification),
    confidence: confidence as DecisionLogEntry["confidence"],
    reason: requiredString(value.reason),
    ...(exception !== undefined ? { exception } : {}),
    policySignals: stringArray(value.policySignals),
    gmailUrl: requiredString(value.gmailUrl),
  }
}

/** Read one optional string field. */
function optionalString(
  /** Unknown decoded value. */
  value: unknown,
): string | undefined {
  return typeof value === "string" ? value : undefined
}

/** Return a clean first-run state. */
function emptyState(): EmailProcessingState {
  return {
    lastHistoryId: null,
    lastCompletedAt: null,
    retryMessageIds: [],
    archiveReversalSenders: [],
  }
}

/** Return the state path outside the dotfiles repository. */
function defaultStatePath(): string {
  return join(homedir(), ".local", "share", "email-processing", "state.json")
}

/** Return the append-only decision-log path outside the dotfiles repository. */
function defaultDecisionLogPath(): string {
  return join(homedir(), ".local", "share", "email-processing", "decisions.jsonl")
}

/** Accept a string or null, defaulting invalid values to null. */
function nullableString(
  /** Unknown decoded value. */
  value: unknown,
): string | null {
  return typeof value === "string" ? value : null
}

/** Require one string field from a durable record. */
function requiredString(
  /** Unknown decoded value. */
  value: unknown,
): string {
  if (typeof value !== "string") throw new Error("Invalid email decision log entry")
  return value
}

/** Keep only strings from an unknown array. */
function stringArray(
  /** Unknown decoded value. */
  value: unknown,
): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === "string") : []
}

/** Keep string-array entries from an unknown record. */
function stringArrayRecord(
  /** Unknown decoded value. */
  value: unknown,
): Record<string, string[]> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      const strings = stringArray(item)
      return strings.length > 0 ? [[key, [...new Set(strings)]]] : []
    }),
  )
}

/** Check whether a decoded value is a non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Allowed durable supervisor outcomes. */
const DECISIONS = new Set(["archive", "promote", "none", "correction", "error"])

/** Allowed qualitative certainty values. */
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"])

/** UTF-8 byte used to delimit JSONL records. */
const NEWLINE_BYTE = 0x0a
