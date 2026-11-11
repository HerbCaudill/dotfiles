import { homedir } from "node:os"
import { join } from "node:path"

import { loadServiceAccountCredentials } from "../google-workspace/loadServiceAccountCredentials.ts"
import { requestDelegatedAccessToken } from "../google-workspace/requestDelegatedAccessToken.ts"
import { EMAIL_PROCESSING_ACCOUNT } from "./constants.ts"
import type {
  GmailClient,
  GmailFilter,
  GmailHistory,
  GmailLabelChange,
  GmailMessage,
  GmailMessageReference,
  GmailProfile,
  GmailThread,
} from "./supervisorTypes.ts"
import { ExpiredGmailHistoryError } from "./supervisorTypes.ts"
import { validateLabelMutation } from "./validateLabelMutation.ts"

/** Create the sole Gmail boundary for the fixed supervised account. */
export function createGmailClient(
  /** Optional request injection for deterministic tests. */
  options: GmailClientOptions = {},
): GmailClient {
  const request = options.request ?? createDelegatedGmailRequest()

  return {
    getProfile: async () => parseProfile(await request({ method: "GET", path: "profile" })),
    listHistory: async startHistoryId => {
      try {
        return await listHistory(request, startHistoryId)
      } catch (error) {
        if (error instanceof GmailApiError && error.status === 404) {
          throw new ExpiredGmailHistoryError()
        }
        throw error
      }
    },
    getMessage: async messageId => {
      try {
        return parseMessage(
          await request({ method: "GET", path: `messages/${encode(messageId)}`, query: FULL }),
        )
      } catch (error) {
        if (error instanceof GmailApiError && error.status === 404) return null
        throw error
      }
    },
    getThread: async threadId =>
      parseThread(
        await request({ method: "GET", path: `threads/${encode(threadId)}`, query: FULL }),
      ),
    isThreadInInbox: async threadId => {
      try {
        const thread = parseRecord(
          await request({
            method: "GET",
            path: `threads/${encode(threadId)}`,
            query: { format: "minimal" },
          }),
        )
        return recordArray(thread.messages).some(message =>
          stringArray(message.labelIds).includes("INBOX"),
        )
      } catch (error) {
        if (error instanceof GmailApiError && error.status === 404) return null
        throw error
      }
    },
    getAttachmentData: async (messageId, attachmentId) =>
      requiredString(
        parseRecord(
          await request({
            method: "GET",
            path: `messages/${encode(messageId)}/attachments/${encode(attachmentId)}`,
          }),
        ).data,
        "attachment data",
      ),
    getLabelIdByName: async name => {
      const labels = recordArray(
        parseRecord(await request({ method: "GET", path: "labels" })).labels,
      )
      const label = labels.find(item => item.name === name)
      return typeof label?.id === "string" ? label.id : null
    },
    hasPriorReplyTo: async address => hasPriorReplyTo(request, address),
    modifyThreadLabels: async (threadId, mutation) => {
      const validatedMutation = validateLabelMutation(mutation)
      await request({
        method: "POST",
        path: `threads/${encode(threadId)}/modify`,
        body: validatedMutation,
      })
    },
    listFilters: async () =>
      recordArray(parseRecord(await request({ method: "GET", path: "settings/filters" })).filter)
        .map(parseFilter)
        .filter(filter => filter !== null),
    createArchiveFilter: async address => {
      if (!EMAIL_ADDRESS_PATTERN.test(address)) throw new Error("Invalid filter sender address")
      const created = parseRecord(
        await request({
          method: "POST",
          path: "settings/filters",
          body: { criteria: { from: address }, action: { removeLabelIds: ["INBOX"] } },
        }),
      )
      return requiredString(created.id, "filter id")
    },
  }
}

/**
 * Build the production request function. It mints one delegated access token and reuses it until
 * shortly before it expires, so a run makes a single token request instead of one per call.
 */
export function createDelegatedGmailRequest(
  /** Injectable token source, fetch and backoff for tests. */
  options: DelegatedGmailRequestOptions = {},
): GmailRequest {
  const fetchFn = options.fetch ?? globalThis.fetch
  const getAccessToken = options.getAccessToken ?? defaultAccessToken
  const sleep = options.sleep ?? (milliseconds => new Promise(r => setTimeout(r, milliseconds)))
  let token: { value: string; expiresAt: number } | null = null

  return async ({ method, path, query, body }) => {
    if (!token || Date.now() >= token.expiresAt) {
      token = { value: await getAccessToken(), expiresAt: Date.now() + TOKEN_REUSE_MS }
    }
    const url = new URL(`${GMAIL_API}/users/${encode(EMAIL_PROCESSING_ACCOUNT)}/${path}`)
    for (const [key, value] of Object.entries(query ?? {})) {
      for (const item of Array.isArray(value) ? value : [value]) {
        url.searchParams.append(key, String(item))
      }
    }
    for (let attempt = 0; ; attempt++) {
      const response = await fetchFn(url, {
        method,
        headers: {
          authorization: `Bearer ${token.value}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.ok) {
        const text = await response.text()
        return text ? (JSON.parse(text) as unknown) : {}
      }
      const responseText = await response.text()
      // Gmail reports rate limits as 429 or as 403 with a rate-limit reason.
      const retryable =
        response.status === 429 ||
        response.status >= 500 ||
        (response.status === 403 && /rateLimitExceeded/i.test(responseText))
      if (retryable && attempt < MAX_ATTEMPTS - 1) {
        await sleep(1_000 * 2 ** attempt)
        continue
      }
      throw new GmailApiError(method, path, response.status, responseText)
    }
  }
}

/** Fetch every history.list page and normalize only candidate and label-change data. */
async function listHistory(
  /** Gmail request function. */
  request: GmailRequest,
  /** Durable Gmail history cursor. */
  startHistoryId: string,
): Promise<GmailHistory> {
  const addedMessages: GmailMessageReference[] = []
  const labelChanges: GmailLabelChange[] = []
  let pageToken: string | undefined

  do {
    const page = parseRecord(
      await request({
        method: "GET",
        path: "history",
        query: { startHistoryId, maxResults: MAX_PAGE_SIZE, ...(pageToken ? { pageToken } : {}) },
      }),
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
  /** Gmail request function. */
  request: GmailRequest,
  /** Exact normalized sender address. */
  address: string,
): Promise<boolean> {
  if (!EMAIL_ADDRESS_PATTERN.test(address)) return false
  const page = parseRecord(
    await request({
      method: "GET",
      path: "messages",
      query: { q: `in:sent to:(${address})`, maxResults: SENT_SEARCH_LIMIT },
    }),
  )

  for (const reference of parseMessageReferences(page.messages)) {
    const message = parseMessage(
      await request({
        method: "GET",
        path: `messages/${encode(reference.messageId)}`,
        query: { format: "metadata", metadataHeaders: ["From", "To", "Cc", "Bcc"] },
      }),
    )
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

/** Mint a delegated Gmail token from the service-account key. */
async function defaultAccessToken(): Promise<string> {
  return requestDelegatedAccessToken(
    loadServiceAccountCredentials(
      process.env.GOOGLE_WORKSPACE_DELEGATED_CREDENTIALS_FILE ??
        join(homedir(), ".config", "google-workspace-delegation", "service-account.json"),
    ),
    {
      fetch: globalThis.fetch,
      now: new Date(),
      scopes: GMAIL_SCOPES,
      subject: EMAIL_PROCESSING_ACCOUNT,
    },
  )
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
  requiredString(message.id, "id")
  requiredString(message.threadId, "threadId")
  requiredString(message.internalDate, "internalDate")
  return message as GmailMessage
}

/** Parse one Gmail thread resource. */
function parseThread(
  /** Unknown decoded Gmail response. */
  value: unknown,
): GmailThread {
  const thread = parseRecord(value)
  if (!Array.isArray(thread.messages)) throw new Error("Invalid Gmail thread response")
  return {
    id: requiredString(thread.id, "id"),
    ...(typeof thread.historyId === "string" ? { historyId: thread.historyId } : {}),
    messages: thread.messages.map(parseMessage),
  }
}

/** Parse the parts of a Gmail filter used for coverage checks. */
function parseFilter(
  /** Unknown filter resource. */
  value: Record<string, unknown>,
): GmailFilter | null {
  if (typeof value.id !== "string") return null
  const criteria = isRecord(value.criteria) ? value.criteria : {}
  const action = isRecord(value.action) ? value.action : {}
  return {
    id: value.id,
    from: typeof criteria.from === "string" ? criteria.from : "",
    removeLabelIds: stringArray(action.removeLabelIds),
  }
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

/** Encode one path segment. */
function encode(
  /** Opaque ID or address. */
  value: string,
): string {
  return encodeURIComponent(value)
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

/** A failed Gmail API call. The response text stays in a property for diagnosis. */
export class GmailApiError extends Error {
  /** HTTP status. */
  readonly status: number

  /** Raw response body. */
  readonly responseText: string

  /** Create an error naming the call and status. */
  constructor(
    /** HTTP method. */
    method: string,
    /** Path below the user. */
    path: string,
    /** HTTP status. */
    status: number,
    /** Raw response body. */
    responseText: string,
  ) {
    super(`Gmail ${method} ${path.split("/")[0]} failed with HTTP ${status}`)
    this.name = "GmailApiError"
    this.status = status
    this.responseText = responseText
  }
}

// CONSTANTS

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1"

/** Scopes the delegated token needs: label changes and reading mail, plus filters. */
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
]

/** Google access tokens last an hour; renew well before that. */
const TOKEN_REUSE_MS = 45 * 60 * 1_000

const REQUEST_TIMEOUT_MS = 30_000

const MAX_ATTEMPTS = 6

const FULL = { format: "full" }

/** Gmail maximum accepted page size. */
const MAX_PAGE_SIZE = 500

/** Conservative Sent search bound for exact-address verification. */
const SENT_SEARCH_LIMIT = 10

/** Conservative exact-address syntax allowed inside Gmail queries and filters. */
const EMAIL_ADDRESS_PATTERN =
  /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)*$/i

// TYPES

/** One Gmail API call below users/{account}/. */
export type GmailRequest = (request: {
  /** HTTP method. */
  method: "GET" | "POST"
  /** Path below the user, such as "messages/123". */
  path: string
  /** Query parameters; arrays become repeated parameters. */
  query?: Record<string, string | number | string[]>
  /** JSON body. */
  body?: unknown
}) => Promise<unknown>

/** Optional Gmail boundary construction dependencies. */
export type GmailClientOptions = {
  /** Gmail API call boundary. */
  request?: GmailRequest
}

/** Injectable boundaries for the production request function. */
export type DelegatedGmailRequestOptions = {
  /** Fetch implementation. */
  fetch?: (url: URL, init: RequestInit) => Promise<Response>
  /** Delegated access token source. */
  getAccessToken?: () => Promise<string>
  /** Backoff delay between retries. */
  sleep?: (milliseconds: number) => Promise<void>
}
