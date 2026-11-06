/*
 * Read-only dry run of the Jev classifier over recent real mail. For the newest received message
 * in each thread, it builds the same candidate the supervisor builds, asks Jev the policy questions,
 * and records what the job would do. It only reads Gmail and never archives, promotes or
 * unsubscribes. Message bodies go to TypeSafe for classification but are not written to disk.
 *
 * Usage: node --experimental-strip-types scripts/email-processing/runJevDryRun.ts [--days 30] [--labels sender-labels.json]
 * Needs JEV_API_KEY and the delegated Google Workspace service-account key.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"

import { loadServiceAccountCredentials } from "../google-workspace/loadServiceAccountCredentials.ts"
import { requestDelegatedAccessToken } from "../google-workspace/requestDelegatedAccessToken.ts"
import { classifyWithJev } from "./classifyWithJev.ts"
import { EMAIL_PROCESSING_ACCOUNT } from "./constants.ts"
import { decideFromJevAnswers } from "./decideFromJevAnswers.ts"
import { normalizeCandidate } from "./runGmailSupervisor.ts"
import type { GmailMessage, GmailSupervisorDependencies, GmailThread } from "./supervisorTypes.ts"

/** Run the dry run and write its JSON results. */
async function main() {
  const { values } = parseArgs({
    options: {
      days: { type: "string", default: "30" },
      labels: { type: "string" },
      concurrency: { type: "string", default: "4" },
    },
  })
  const apiKey = process.env.JEV_API_KEY
  if (!apiKey) throw new Error("JEV_API_KEY is not set")
  const days = Number(values.days)
  const labels = loadLabels(values.labels)
  const evaluatedAt = new Date().toISOString()
  const token = await getGmailToken()

  const sentRecipients = await getSentRecipients(token)
  console.error(`sent recipients known: ${sentRecipients.size}`)
  const references = await listMessages(token, `newer_than:${days}d -in:sent -in:chats -in:drafts`)
  const threadIds = [...new Set(references.map(reference => reference.threadId))]
  console.error(`received messages: ${references.length}; threads: ${threadIds.length}`)

  const receivedIds = new Set(references.map(reference => reference.id))
  const dependencies = {
    gmail: { hasPriorReplyTo: async (address: string) => sentRecipients.has(address) },
  } as unknown as GmailSupervisorDependencies
  const emptyState = {
    lastHistoryId: null,
    lastCompletedAt: null,
    retryMessageIds: [],
    archiveReversalSenders: [],
  }

  let done = 0
  const records = await mapWithConcurrency(
    threadIds,
    Number(values.concurrency),
    async threadId => {
      const thread = (await gmailGet(token, `threads/${threadId}`, {
        format: "full",
      })) as GmailThread
      // Mirror the supervisor: classify only the newest message in the thread that arrived in the window.
      const message = thread.messages
        .filter(threadMessage => receivedIds.has(threadMessage.id))
        .at(-1)
      if (++done % 100 === 0) console.error(`classified ${done}/${threadIds.length}`)
      if (!message) return null
      return classifyMessage({
        message,
        thread,
        evaluatedAt,
        apiKey,
        dependencies,
        emptyState,
        labels,
      })
    },
  )

  const results = records.filter(record => record !== null)
  const output = {
    createdAt: evaluatedAt,
    windowDays: days,
    account: EMAIL_PROCESSING_ACCOUNT,
    questionsVersion: `sha256:${createHash("sha256").update(readFileSync(QUESTIONS_PATH)).digest("hex")}`,
    labelsSource: labels.source,
    receivedMessages: references.length,
    threads: threadIds.length,
    records: results,
  }
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true })
  const outputPath = join(OUTPUT_DIRECTORY, `dry-run-${evaluatedAt.slice(0, 10)}.json`)
  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(outputPath)
}

/** Classify one message with Jev and record what the job would do. */
async function classifyMessage(
  /** Message, thread and run context. */
  context: {
    message: GmailMessage
    thread: GmailThread
    evaluatedAt: string
    apiKey: string
    dependencies: GmailSupervisorDependencies
    emptyState: Parameters<typeof normalizeCandidate>[2]
    labels: Labels
  },
) {
  const { message, thread } = context
  const header = (name: string) =>
    message.payload?.headers?.find(entry => entry.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  const listUnsubscribe = header("List-Unsubscribe")
  const listId = header("List-Id")
  const oneClickUnsubscribe =
    /<https:\/\/[^>]+>/.test(listUnsubscribe) &&
    /List-Unsubscribe=One-Click/i.test(header("List-Unsubscribe-Post"))

  const base = {
    messageId: message.id,
    threadId: message.threadId,
    gmailUrl: `https://mail.google.com/mail/#all/${message.threadId}`,
    labelIds: message.labelIds ?? [],
    hasListUnsubscribe: listUnsubscribe.length > 0,
    oneClickUnsubscribe,
    listId,
  }
  try {
    const candidate = await normalizeCandidate(
      message,
      thread,
      context.emptyState,
      context.dependencies,
    )
    const jev = await classifyWithJev(
      {
        candidate,
        evaluatedAt: context.evaluatedAt,
        listId,
        listUnsubscribe: listUnsubscribe.length > 0,
      },
      { apiKey: context.apiKey },
    )
    const decision = decideFromJevAnswers({
      answers: jev.answers,
      category: candidate.category,
      senderAddress: candidate.sender.address,
      listId,
      oneClickUnsubscribe,
      archiveProtections: candidate.archiveProtections,
    })
    const routine = jev.answers.routine_authentication.noul >= 0.5
    return {
      ...base,
      receivedAt: candidate.receivedAt,
      sender: candidate.sender,
      // Keep one-time codes out of the results file, as the decision log does.
      subject: routine
        ? candidate.subject.replace(/\b[A-Z0-9-]{4,10}\b/g, code =>
            /\d/.test(code) ? "[code]" : code,
          )
        : candidate.subject,
      category: candidate.category,
      archiveProtections: candidate.archiveProtections,
      jev: {
        model: jev.model,
        inputTokens: jev.inputTokens,
        latencyMs: jev.latencyMs,
        answers: jev.answers,
      },
      decision,
      label: context.labels.labels[candidate.sender.address] ?? null,
    }
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Collect exact addresses Herb has sent mail to in the last two years. */
async function getSentRecipients(
  /** Access token. */
  token: string,
) {
  const references = await listMessages(token, "in:sent newer_than:2y")
  const recipients = new Set<string>()
  await mapWithConcurrency(references, 8, async reference => {
    const message = (await gmailGet(token, `messages/${reference.id}`, { format: "metadata" }, [
      "To",
      "Cc",
      "Bcc",
    ])) as GmailMessage
    for (const header of message.payload?.headers ?? []) {
      for (const address of header.value.match(/[\w.+'-]+@[\w.-]+\w/g) ?? [])
        recipients.add(address.toLowerCase())
    }
  })
  return recipients
}

/** List message references matching a Gmail query. */
async function listMessages(
  /** Access token. */
  token: string,
  /** Gmail search query. */
  q: string,
) {
  const references: { id: string; threadId: string }[] = []
  let pageToken: string | undefined
  do {
    const page = await gmailGet(token, "messages", {
      q,
      maxResults: "500",
      ...(pageToken ? { pageToken } : {}),
    })
    references.push(...(page.messages ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return references
}

/** Get a delegated Gmail token. Delegation doesn't authorize gmail.readonly, so this script only issues GETs. */
async function getGmailToken() {
  return requestDelegatedAccessToken(
    loadServiceAccountCredentials(
      join(homedir(), ".config", "google-workspace-delegation", "service-account.json"),
    ),
    {
      fetch: globalThis.fetch,
      now: new Date(),
      scopes: ["https://www.googleapis.com/auth/gmail.modify"],
      subject: EMAIL_PROCESSING_ACCOUNT,
    },
  )
}

/** Call a Gmail API GET endpoint, retrying rate limits (which Gmail reports as 403 or 429). */
async function gmailGet(
  /** Access token. */
  token: string,
  /** Path below users/me/. */
  path: string,
  /** Query parameters. */
  params: Record<string, string>,
  /** Repeated metadataHeaders parameters. */
  metadataHeaders: readonly string[] = [],
): Promise<any> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  for (const header of metadataHeaders) url.searchParams.append("metadataHeaders", header)
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    })
    if (response.ok) return response.json()
    if ([403, 429].includes(response.status) || response.status >= 500) {
      if (attempt < 8) {
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt))
        continue
      }
    }
    throw new Error(`Gmail GET ${path} failed: HTTP ${response.status}`)
  }
}

/** Run an async function over items with bounded concurrency, preserving order. */
async function mapWithConcurrency<T, R>(
  /** Items to process. */
  items: readonly T[],
  /** Maximum simultaneous calls. */
  limit: number,
  /** Async transform. */
  fn: (item: T) => Promise<R>,
) {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await fn(items[index])
      }
    }),
  )
  return results
}

/** Load optional sender labels to compare against. */
function loadLabels(
  /** Path to a labels file, or undefined. */
  path: string | undefined,
): Labels {
  const resolved = path ?? join(OUTPUT_DIRECTORY, "sender-labels.json")
  return existsSync(resolved)
    ? JSON.parse(readFileSync(resolved, "utf8"))
    : { source: null, labels: {} }
}

// CONSTANTS

const OUTPUT_DIRECTORY = join(homedir(), ".local", "share", "email-processing", "jev-dry-run")

const QUESTIONS_PATH = new URL("./jevQuestions.json", import.meta.url)

// TYPES

type Labels = {
  /** Where the labels came from. */
  source: string | null
  /** Expected label by exact sender address. */
  labels: Record<string, "marketing" | "not-marketing">
}

await main()
