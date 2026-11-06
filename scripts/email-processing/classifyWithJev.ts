import { readFileSync } from "node:fs"

import type { JevAnswers } from "./decideFromJevAnswers.ts"
import type { ClassifierCandidate, NormalizedThreadMessage } from "./types.ts"

/** Ask Jev the email policy questions about one candidate message. */
export async function classifyWithJev(
  /** Candidate message and the bulk-mail facts read from its headers. */
  input: JevClassifyInput,
  /** API key and injectable fetch. */
  options: JevClientOptions,
): Promise<JevClassification> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const body = JSON.stringify({
    model: options.model ?? "jev-latest",
    state: buildState(input),
    questions: QUESTIONS,
  })

  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now()
    const response = await fetchFn(JEV_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    })
    if (response.ok) {
      const result = (await response.json()) as JevResponse
      return {
        model: result.model,
        answers: result.answers,
        inputTokens: result.usage?.input_tokens ?? 0,
        latencyMs: Date.now() - startedAt,
      }
    }
    // TypeSafe asks clients to back off and retry rate limits and overloads.
    if (
      (response.status === 429 || response.status === 529 || response.status >= 500) &&
      attempt < 5
    ) {
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt))
      continue
    }
    throw new Error(
      `Jev request failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
    )
  }
}

/** Build Jev's state from the message, leaving supervisor-only facts out. */
function buildState(
  /** Candidate and header facts. */
  input: JevClassifyInput,
) {
  const { candidate } = input
  return {
    evaluatedAt: input.evaluatedAt,
    recipientMailbox: "herb@devresults.com (Herb Caudill, owner of DevResults)",
    message: {
      receivedAt: candidate.receivedAt,
      from: candidate.sender,
      to: candidate.recipients.slice(0, 10),
      subject: candidate.subject,
      gmailCategory: candidate.category,
      bulkMail: { listUnsubscribe: input.listUnsubscribe, listId: input.listId },
      body: compactText(candidate.body, MAX_BODY_CHARACTERS),
    },
    earlierInThread: candidate.thread.slice(-MAX_THREAD_MESSAGES).map(toThreadState),
  }
}

/** Reduce an earlier thread message to what helps judge the current one. */
function toThreadState(
  /** Earlier message in the thread. */
  message: NormalizedThreadMessage,
) {
  return {
    receivedAt: message.receivedAt,
    from: message.sender,
    subject: message.subject,
    body: compactText(message.body, MAX_THREAD_BODY_CHARACTERS),
  }
}

/** Collapse whitespace and long links so the message fits Jev's context budget. */
function compactText(
  /** Message text. */
  text: string,
  /** Maximum characters kept. */
  limit: number,
) {
  const compacted = text
    .replace(/https?:\/\/\S{40,}/g, "[link]")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return compacted.length > limit ? `${compacted.slice(0, limit)} [truncated]` : compacted
}

// CONSTANTS

const JEV_URL = "https://api.typesafe.ai/v1/systemone"

const QUESTIONS = JSON.parse(readFileSync(new URL("./jevQuestions.json", import.meta.url), "utf8"))

// Jev allows 32k tokens per question including state; these keep a message well under that.
const MAX_BODY_CHARACTERS = 12_000
const MAX_THREAD_MESSAGES = 3
const MAX_THREAD_BODY_CHARACTERS = 2_000

// TYPES

/** One message to classify. */
export type JevClassifyInput = {
  /** Candidate normalized the same way as for the Codex classifier. */
  candidate: ClassifierCandidate
  /** Stable wall-clock time for freshness judgments. */
  evaluatedAt: string
  /** Raw List-Id header, or an empty string. */
  listId: string
  /** Whether the message carries a List-Unsubscribe header. */
  listUnsubscribe: boolean
}

/** Client configuration. */
export type JevClientOptions = {
  /** TypeSafe API key. */
  apiKey: string
  /** Model name or alias. */
  model?: string
  /** Injectable fetch for tests. */
  fetch?: (url: string | URL | Request, init?: RequestInit) => Promise<Response>
}

/** Jev's answers and usage for one message. */
export type JevClassification = {
  /** Versioned model that answered. */
  model: string
  /** Typed answers keyed by question. */
  answers: JevAnswers
  /** Billable input tokens. */
  inputTokens: number
  /** Round-trip time for the successful request. */
  latencyMs: number
}

type JevResponse = {
  /** Versioned model ID. */
  model: string
  /** Answers keyed by question name. */
  answers: JevAnswers
  /** Token usage. */
  usage?: { input_tokens?: number }
}
