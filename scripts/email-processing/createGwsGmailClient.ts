import { spawnSync } from "node:child_process"

import { EMAIL_PROCESSING_ACCOUNT } from "./constants.ts"
import type {
  GmailClient,
  GmailHistory,
  GmailLabelChange,
  GmailMessage,
  GmailMessageReference,
  GmailProfile,
  GmailThread,
} from "./supervisorTypes.ts"
import { ExpiredGmailHistoryError } from "./supervisorTypes.ts"
import type { LabelMutation } from "./types.ts"
import { validateLabelMutation } from "./validateLabelMutation.ts"

/** Create the sole Gmail CLI boundary for the fixed supervised account. */
export function createGwsGmailClient(
  /** Optional command runner injection for deterministic tests. */
  options: GwsGmailClientOptions = {},
): GmailClient {
  const run = options.run ?? runGws

  return {
    getProfile: async () =>
      parseProfile(
        await invoke(run, [
          "gmail",
          "users",
          "getProfile",
          "--params",
          params({ userId: EMAIL_PROCESSING_ACCOUNT }),
        ]),
      ),
    listRecentInboxMessages: async after =>
      listMessages(run, {
        userId: EMAIL_PROCESSING_ACCOUNT,
        q: `in:inbox after:${Math.floor(after.getTime() / 1_000)} -in:spam -in:trash`,
        maxResults: MAX_PAGE_SIZE,
      }),
    listHistory: async startHistoryId => {
      try {
        return await listHistory(run, startHistoryId)
      } catch (error) {
        if (isExpiredHistoryError(error)) throw new ExpiredGmailHistoryError()
        throw error
      }
    },
    getMessage: async messageId =>
      parseMessage(await invoke(run, messageGetArgs(messageId, "full"))),
    getThread: async threadId =>
      parseThread(
        await invoke(run, [
          "gmail",
          "users",
          "threads",
          "get",
          "--params",
          params({ userId: EMAIL_PROCESSING_ACCOUNT, id: threadId, format: "full" }),
        ]),
      ),
    hasPriorReplyTo: async address => hasPriorReplyTo(run, address),
    modifyThreadLabels: async (threadId, mutation) => {
      const validatedMutation = validateLabelMutation(mutation)
      await invoke(run, [
        "gmail",
        "users",
        "threads",
        "modify",
        "--params",
        params({ userId: EMAIL_PROCESSING_ACCOUNT, id: threadId }),
        "--json",
        JSON.stringify(validatedMutation),
      ])
    },
  }
}

/** Fetch every messages.list page and deduplicate message references. */
async function listMessages(
  /** Fixed gws command runner. */
  run: GwsCommandRunner,
  /** Initial Gmail query parameters. */
  initialParams: Record<string, unknown>,
): Promise<GmailMessageReference[]> {
  const messages: GmailMessageReference[] = []
  let pageToken: string | undefined

  do {
    const page = parseRecord(
      await invoke(run, [
        "gmail",
        "users",
        "messages",
        "list",
        "--params",
        params(pageToken ? { ...initialParams, pageToken } : initialParams),
      ]),
    )
    messages.push(...parseMessageReferences(page.messages))
    pageToken = optionalString(page.nextPageToken)
  } while (pageToken)

  return deduplicateReferences(messages)
}

/** Fetch every history.list page and normalize only candidate and label-change data. */
async function listHistory(
  /** Fixed gws command runner. */
  run: GwsCommandRunner,
  /** Durable Gmail history cursor. */
  startHistoryId: string,
): Promise<GmailHistory> {
  const addedMessages: GmailMessageReference[] = []
  const labelChanges: GmailLabelChange[] = []
  let pageToken: string | undefined

  do {
    const query = {
      userId: EMAIL_PROCESSING_ACCOUNT,
      startHistoryId,
      maxResults: MAX_PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    }
    const page = parseRecord(
      await invoke(run, ["gmail", "users", "history", "list", "--params", params(query)]),
    )
    for (const item of recordArray(page.history)) {
      for (const added of recordArray(item.messagesAdded)) {
        const message = parseMessageReference(added.message)
        if (message) addedMessages.push(message)
      }
      labelChanges.push(...parseLabelChanges(item.labelsAdded, "addedLabelIds"))
      labelChanges.push(...parseLabelChanges(item.labelsRemoved, "removedLabelIds"))
    }
    pageToken = optionalString(page.nextPageToken)
  } while (pageToken)

  return { addedMessages: deduplicateReferences(addedMessages), labelChanges }
}

/** Search Sent mail and verify an exact recipient address from message metadata. */
async function hasPriorReplyTo(
  /** Fixed gws command runner. */
  run: GwsCommandRunner,
  /** Exact normalized sender address. */
  address: string,
): Promise<boolean> {
  if (!EMAIL_ADDRESS_PATTERN.test(address)) return false
  const page = parseRecord(
    await invoke(run, [
      "gmail",
      "users",
      "messages",
      "list",
      "--params",
      params({
        userId: EMAIL_PROCESSING_ACCOUNT,
        q: `in:sent to:(${address})`,
        maxResults: SENT_SEARCH_LIMIT,
      }),
    ]),
  )

  for (const reference of parseMessageReferences(page.messages)) {
    const message = parseMessage(await invoke(run, messageGetArgs(reference.messageId, "metadata")))
    const headers = message.payload?.headers ?? []
    const fromAddresses = parseHeaderAddresses(headers, ["from"])
    const recipientAddresses = parseHeaderAddresses(headers, ["to", "cc", "bcc"])
    if (
      fromAddresses.includes(EMAIL_PROCESSING_ACCOUNT) &&
      recipientAddresses.includes(address.toLowerCase())
    ) {
      return true
    }
  }
  return false
}

/** Return the fixed messages.get invocation for one approved format. */
function messageGetArgs(
  /** Opaque Gmail message ID. */
  messageId: string,
  /** Approved Gmail response format. */
  format: "full" | "metadata",
): string[] {
  return [
    "gmail",
    "users",
    "messages",
    "get",
    "--params",
    params({
      userId: EMAIL_PROCESSING_ACCOUNT,
      id: messageId,
      format,
      ...(format === "metadata" ? { metadataHeaders: ["From", "To", "Cc", "Bcc"] } : {}),
    }),
  ]
}

/** Run a fixed argument vector and parse its JSON response. */
async function invoke(
  /** Fixed gws command runner. */
  run: GwsCommandRunner,
  /** Argument-array invocation with no shell interpolation. */
  args: readonly string[],
): Promise<unknown> {
  return JSON.parse(await run(args)) as unknown
}

/** Execute gws with unattended delegated authentication and no shell. */
async function runGws(
  /** Fixed argument-array invocation. */
  args: readonly string[],
): Promise<string> {
  const result = spawnSync("gws-delegated", [...args], {
    encoding: "utf8",
    timeout: GWS_TIMEOUT_MS,
    maxBuffer: GWS_MAX_OUTPUT_BYTES,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new GwsInvocationError(result.status, `${result.stderr ?? ""}\n${result.stdout ?? ""}`)
  }
  return result.stdout
}

/** Parse the narrow Gmail profile response. */
function parseProfile(
  /** Unknown decoded Gmail response. */
  value: unknown,
): GmailProfile {
  const profile = parseRecord(value)
  const emailAddress = requiredString(profile.emailAddress, "emailAddress").toLowerCase()
  if (emailAddress !== EMAIL_PROCESSING_ACCOUNT) {
    throw new Error("Unexpected Gmail account")
  }
  return { historyId: requiredString(profile.historyId, "historyId") }
}

/** Parse one Gmail message resource. */
function parseMessage(
  /** Unknown decoded Gmail response. */
  value: unknown,
): GmailMessage {
  const message = parseRecord(value)
  return message as GmailMessage
}

/** Parse one Gmail thread resource. */
function parseThread(
  /** Unknown decoded Gmail response. */
  value: unknown,
): GmailThread {
  const thread = parseRecord(value)
  if (!Array.isArray(thread.messages)) throw new Error("Invalid Gmail thread response")
  return thread as GmailThread
}

/** Parse message references from a nullable API list. */
function parseMessageReferences(
  /** Unknown decoded messages list. */
  value: unknown,
): GmailMessageReference[] {
  return recordArray(value).flatMap(item => {
    const reference = parseMessageReference(item)
    return reference ? [reference] : []
  })
}

/** Parse one Gmail message reference. */
function parseMessageReference(
  /** Unknown decoded message reference. */
  value: unknown,
): GmailMessageReference | null {
  if (!isRecord(value) || typeof value.id !== "string") return null
  return {
    messageId: value.id,
    ...(typeof value.threadId === "string" ? { threadId: value.threadId } : {}),
  }
}

/** Parse label history records into one-sided exact transitions. */
function parseLabelChanges(
  /** Unknown Gmail label-history list. */
  value: unknown,
  /** Side of the transition represented by the list. */
  side: "addedLabelIds" | "removedLabelIds",
): GmailLabelChange[] {
  return recordArray(value).flatMap(item => {
    const message = parseMessageReference(item.message)
    if (!message) return []
    const labelIds = stringArray(item.labelIds)
    return [
      {
        messageId: message.messageId,
        addedLabelIds: side === "addedLabelIds" ? labelIds : [],
        removedLabelIds: side === "removedLabelIds" ? labelIds : [],
      },
    ]
  })
}

/** Deduplicate message references by opaque message ID. */
function deduplicateReferences(
  /** References in Gmail response order. */
  references: GmailMessageReference[],
): GmailMessageReference[] {
  return [...new Map(references.map(reference => [reference.messageId, reference])).values()]
}

/** Parse exact lowercased addresses from selected Gmail headers. */
function parseHeaderAddresses(
  /** Gmail message headers. */
  headers: NonNullable<GmailMessage["payload"]>["headers"],
  /** Lowercase header names to include. */
  names: string[],
): string[] {
  const nameSet = new Set(names)
  return (headers ?? [])
    .filter(header => nameSet.has(header.name.toLowerCase()))
    .flatMap(header => header.value.split(","))
    .map(fragment => fragment.match(/<([^<>]+)>/)?.[1] ?? fragment)
    .map(address => address.trim().toLowerCase())
}

/** Detect only the history-expiration failures eligible for a recent-mail fallback. */
function isExpiredHistoryError(
  /** Unknown invocation failure. */
  error: unknown,
): boolean {
  const text =
    error instanceof GwsInvocationError
      ? error.responseText
      : error instanceof Error
        ? error.message
        : ""
  return /\b404\b/.test(text) || /history(?:id)?.*(?:expired|invalid|not found)/i.test(text)
}

/** Encode Gmail query parameters as one inert JSON argument. */
function params(
  /** JSON-safe URL and query values. */
  value: Record<string, unknown>,
): string {
  return JSON.stringify(value)
}

/** Require one string field from a Gmail response. */
function requiredString(
  /** Unknown decoded value. */
  value: unknown,
  /** Field name for the safe validation error. */
  field: string,
): string {
  if (typeof value !== "string") throw new Error(`Invalid Gmail ${field} response`)
  return value
}

/** Read an optional string field. */
function optionalString(
  /** Unknown decoded value. */
  value: unknown,
): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/** Return object items from an unknown array. */
function recordArray(
  /** Unknown decoded value. */
  value: unknown,
): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/** Return string items from an unknown array. */
function stringArray(
  /** Unknown decoded value. */
  value: unknown,
): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === "string") : []
}

/** Require a non-array decoded JSON object. */
function parseRecord(
  /** Unknown decoded response. */
  value: unknown,
): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Invalid Gmail response")
  return value
}

/** Check whether a decoded value is a non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Captured gws failure used only to identify expired Gmail history. */
class GwsInvocationError extends Error {
  /** Process exit status. */
  readonly status: number | null

  /** Raw response inspected only inside the Gmail boundary. */
  readonly responseText: string

  /** Create a safe external error with private diagnostic fields. */
  constructor(
    /** Process exit status. */
    status: number | null,
    /** Raw gws response. */
    responseText: string,
  ) {
    super(`gws Gmail command failed (exit ${status ?? "unknown"})`)
    this.name = "GwsInvocationError"
    this.status = status
    this.responseText = responseText
  }
}

/** Optional Gmail boundary construction dependencies. */
export type GwsGmailClientOptions = {
  /** Execute one fixed gws argument vector and return JSON stdout. */
  run?: GwsCommandRunner
}

/** Argument-array gws command runner. */
export type GwsCommandRunner = (
  /** Fixed subcommand and JSON argument vector. */
  args: readonly string[],
) => Promise<string>

/** Gmail maximum accepted page size. */
const MAX_PAGE_SIZE = 500

/** Conservative Sent search bound for exact-address verification. */
const SENT_SEARCH_LIMIT = 10

/** Per-command gws timeout. */
const GWS_TIMEOUT_MS = 30_000

/** Maximum gws stdout or stderr retained in memory. */
const GWS_MAX_OUTPUT_BYTES = 20 * 1024 * 1024

/** Conservative exact-address syntax allowed inside the Gmail Sent query. */
const EMAIL_ADDRESS_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)*$/i
