import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { FILTER_PROPOSAL_MIN_ARCHIVES, FILTER_PROPOSAL_WINDOW_DAYS } from "./constants.ts"
import type { EmailTasksClient } from "./emailTasks.ts"
import { extractLoggedAddress } from "./runGmailSupervisor.ts"
import type {
  DecisionLogEntry,
  GmailClient,
  GmailFilter,
  UnsubscribeCandidate,
} from "./supervisorTypes.ts"

/*
 * The job never unsubscribes or creates filters on its own. Runs queue unsubscribe candidates; a
 * daily step turns them, plus senders the job keeps archiving, into batches, one Tasks Inbox item
 * per kind; `approve` acts only on the senders Herb approved and remembers the ones he declined.
 */

/** Add or refresh one sender in the pending unsubscribe queue. */
export async function queueUnsubscribe(
  /** Sender and one-click URL from the latest message. */
  candidate: UnsubscribeCandidate,
  /** Store path, injectable for tests. */
  path = defaultPaths().store,
): Promise<void> {
  await updateProposalStore(path, store => {
    store.pendingUnsubscribes[candidate.address] = candidate
  })
}

/**
 * Turn pending work into at most one open batch per kind and make sure each batch has its Tasks
 * Inbox item. A kind with an open batch waits until Herb has dealt with it.
 */
export async function proposeBatches(
  /** Clock, Gmail, Tasks and log boundaries. */
  dependencies: ProposalDependencies,
): Promise<string[]> {
  const paths = { ...defaultPaths(), ...dependencies.paths }
  const now = dependencies.now()
  const [decisions, unsubscribed] = await Promise.all([
    dependencies.loadDecisionLog(),
    loadUnsubscribedAddresses(paths.unsubscribeLog),
  ])
  const store = await loadProposalStore(paths.store)
  const proposed = new Set(
    store.batches.flatMap(batch => batch.items.map(item => `${batch.kind}:${item.address}`)),
  )
  const hasOpen = (kind: ProposalKind) =>
    store.batches.some(batch => batch.kind === kind && batch.status === "open")

  const newBatches: ProposalBatch[] = []
  if (!hasOpen("unsubscribe")) {
    const items = Object.values(store.pendingUnsubscribes)
      .filter(
        candidate =>
          !unsubscribed.has(candidate.address) &&
          !store.declined.unsubscribe.includes(candidate.address) &&
          !proposed.has(`unsubscribe:${candidate.address}`),
      )
      .sort((left, right) => left.address.localeCompare(right.address))
      .map(candidate => ({
        address: candidate.address,
        name: candidate.name,
        sampleSubject: candidate.sampleSubject,
        url: candidate.url,
        messageId: candidate.messageId,
        threadId: candidate.threadId,
        receivedAt: candidate.receivedAt,
      }))
    if (items.length > 0) newBatches.push(createBatch("unsubscribe", items, now, store))
  }
  if (!hasOpen("filter")) {
    const senders = findFilterCandidates(decisions, now).filter(
      sender =>
        !store.declined.filter.includes(sender.address) &&
        !proposed.has(`filter:${sender.address}`),
    )
    if (senders.length > 0) {
      const filters = await dependencies.gmail.listFilters()
      const items = senders.filter(sender => !isCoveredByFilter(sender.address, filters))
      if (items.length > 0) newBatches.push(createBatch("filter", items, now, store))
    }
  }

  await updateProposalStore(paths.store, current => {
    current.batches.push(...newBatches)
    for (const batch of newBatches.filter(item => item.kind === "unsubscribe")) {
      for (const item of batch.items) delete current.pendingUnsubscribes[item.address]
    }
  })

  const lines: string[] = []
  for (const batch of (await loadProposalStore(paths.store)).batches) {
    if (batch.status !== "open" || batch.task.described) continue
    await ensureBatchTask(batch.id, paths.store, dependencies.tasks)
    lines.push(`proposed ${batch.id} senders=${batch.items.length}`)
  }
  return lines.length > 0 ? lines : ["proposed nothing"]
}

/** Carry out an approved batch for every sender except the ones Herb declined, then complete its task. */
export async function approveBatch(
  /** Clock, Gmail, Tasks and fetch boundaries. */
  dependencies: ProposalDependencies,
  /** Batch to approve. */
  batchId: string,
  /** Sender addresses Herb declined. */
  except: readonly string[],
): Promise<string[]> {
  const paths = { ...defaultPaths(), ...dependencies.paths }
  const batch = requireOpenBatch(await loadProposalStore(paths.store), batchId)
  const declined = new Set(except.map(address => address.trim().toLowerCase()).filter(Boolean))
  const unknown = [...declined].filter(
    address => !batch.items.some(item => item.address === address),
  )
  if (unknown.length > 0) throw new Error(`Not in ${batchId}: ${unknown.join(", ")}`)

  const acting = batch.items.some(item => !declined.has(item.address))
  const filters = batch.kind === "filter" && acting ? await dependencies.gmail.listFilters() : []
  const lines: string[] = []
  for (const item of batch.items) {
    if (batch.results.some(result => result.address === item.address)) continue
    const result = declined.has(item.address)
      ? { address: item.address, outcome: "declined" as const, detail: "" }
      : batch.kind === "unsubscribe"
        ? await unsubscribe(item, batch.id, dependencies, paths.unsubscribeLog)
        : await createFilter(item, batch.id, filters, dependencies, paths.filterLog)
    await updateProposalStore(paths.store, store => {
      const current = requireOpenBatch(store, batchId)
      current.results.push(result)
      if (result.outcome === "declined") store.declined[batch.kind].push(item.address)
    })
    lines.push(`${result.outcome} ${item.address}${result.detail ? ` (${result.detail})` : ""}`)
  }
  await finishBatch(batchId, paths.store, dependencies)
  return lines
}

/** Decline every sender in a batch and complete its task. */
export async function declineBatch(
  /** Clock, Gmail, Tasks and fetch boundaries. */
  dependencies: ProposalDependencies,
  /** Batch to decline. */
  batchId: string,
): Promise<string[]> {
  const paths = { ...defaultPaths(), ...dependencies.paths }
  const batch = requireOpenBatch(await loadProposalStore(paths.store), batchId)
  return approveBatch(
    dependencies,
    batchId,
    batch.items.map(item => item.address),
  )
}

/**
 * Find senders the job archived at least the minimum number of times in the window and never
 * kept, restored or wrote to. People, calendar replies and devresults.com senders are left out.
 */
export function findFilterCandidates(
  /** Decision log in append order. */
  decisions: readonly DecisionLogEntry[],
  /** Current time. */
  now: Date,
): ProposalItem[] {
  const since = new Date(now.getTime() - FILTER_PROPOSAL_WINDOW_DAYS * 86_400_000).toISOString()
  const bySender = new Map<string, DecisionLogEntry[]>()
  const excluded = new Set<string>()
  for (const entry of decisions) {
    const address = extractLoggedAddress(entry.sender)
    if (!address) continue
    if (entry.decision === "correction") excluded.add(address)
    if (entry.timestamp < since || !["archive", "promote", "none"].includes(entry.decision))
      continue
    if (NON_SENDER_CLASSIFICATIONS.has(entry.classification)) continue
    bySender.set(address, [...(bySender.get(address) ?? []), entry])
  }
  return [...bySender]
    .filter(
      ([address, entries]) =>
        !excluded.has(address) &&
        !address.endsWith("@devresults.com") &&
        entries.length >= FILTER_PROPOSAL_MIN_ARCHIVES &&
        entries.every(
          entry =>
            entry.decision === "archive" &&
            entry.jev?.mailKind !== "personal" &&
            !entry.policySignals.includes("prior-reply"),
        ),
    )
    .map(([address, entries]) => {
      const latest = entries.at(-1)!
      return {
        address,
        name: latest.sender.match(/^(.*?)\s*<[^<>]+>\s*$/)?.[1] ?? "",
        sampleSubject: latest.subject,
        archives: entries.length,
        messageId: latest.messageId,
        threadId: latest.threadId,
      }
    })
    .sort(
      (left, right) =>
        right.archives! - left.archives! || left.address.localeCompare(right.address),
    )
}

/** Check whether an existing filter already skips the inbox for an address or its domain. */
export function isCoveredByFilter(
  /** Exact lowercase sender address. */
  address: string,
  /** Existing Gmail filters. */
  filters: readonly GmailFilter[],
): boolean {
  const domain = address.split("@")[1] ?? ""
  return filters.some(filter => {
    if (!filter.removeLabelIds.includes("INBOX")) return false
    const terms = filter.from
      .toLowerCase()
      .split(/\s+or\s+|[\s{}()|,]+/)
      .filter(Boolean)
    return terms.some(term => term === address || term === domain || term === `@${domain}`)
  })
}

/** Write the Markdown description for a batch's Tasks item. */
export function describeBatch(
  /** Batch to describe. */
  batch: ProposalBatch,
): string {
  const intro =
    batch.kind === "unsubscribe"
      ? "The email job found marketing senders it can unsubscribe from with one click. Nothing has been sent yet."
      : `The email job archived every message from these senders at least ${FILTER_PROPOSAL_MIN_ARCHIVES} times in ${FILTER_PROPOSAL_WINDOW_DAYS} days. Each would get a Gmail filter that skips the inbox. Nothing has been created yet.`
  const senders = batch.items.map((item, index) => {
    const who = item.name ? `${item.name} <${item.address}>` : item.address
    const count = item.archives ? ` (${item.archives} archived)` : ""
    return `${index + 1}. ${who}${count} – “${item.sampleSubject}”`
  })
  return [
    intro,
    "",
    "Go through the list with Herb, then run one of these on the mini:",
    "",
    `- Approve all: \`email-processing approve ${batch.id}\``,
    `- Approve all but some: \`email-processing approve ${batch.id} --except a@example.com,b@example.com\``,
    `- Decline all: \`email-processing decline ${batch.id}\``,
    "",
    "The command records what Herb declined, so those senders aren't proposed again, and completes this task.",
    "",
    ...senders,
  ].join("\n")
}

/** Send one RFC 8058 one-click unsubscribe request and log it. */
async function unsubscribe(
  /** Approved sender. */
  item: ProposalItem,
  /** Batch ID, recorded as the list. */
  batchId: string,
  /** Fetch and clock. */
  dependencies: ProposalDependencies,
  /** Unsubscribe log path. */
  logPath: string,
): Promise<ProposalResult> {
  let outcome: ProposalResult["outcome"]
  let detail: string
  let endpointHost = ""
  try {
    const url = new URL(item.url!)
    if (url.protocol !== "https:") throw new Error("Unsubscribe URL is not https")
    endpointHost = url.host
    // Redirects are not followed: a one-click endpoint answers the POST itself.
    const response = await dependencies.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    })
    outcome =
      response.status >= 200 && response.status < 300
        ? "unsubscribed"
        : response.status >= 300 && response.status < 400
          ? "uncertain"
          : "failed"
    detail = `HTTP ${response.status}`
  } catch (error) {
    outcome = "failed"
    detail = error instanceof Error ? error.message : String(error)
  }
  await appendJsonLine(logPath, {
    timestamp: dependencies.now().toISOString(),
    list: batchId,
    sender: item.address,
    name: item.name,
    domain: item.address.split("@")[1] ?? "",
    endpointHost,
    messageId: item.messageId,
    threadId: item.threadId,
    messageReceivedAt: item.receivedAt ?? "",
    result: outcome === "unsubscribed" ? "accepted" : outcome,
    detail,
  })
  return { address: item.address, outcome, detail }
}

/** Create one archive filter unless an existing filter already covers the sender, and log it. */
async function createFilter(
  /** Approved sender. */
  item: ProposalItem,
  /** Batch ID. */
  batchId: string,
  /** Filters that existed when approval started. */
  filters: readonly GmailFilter[],
  /** Gmail and clock. */
  dependencies: ProposalDependencies,
  /** Filter log path. */
  logPath: string,
): Promise<ProposalResult> {
  let result: ProposalResult
  if (isCoveredByFilter(item.address, filters)) {
    result = { address: item.address, outcome: "already-filtered", detail: "" }
  } else {
    try {
      const filterId = await dependencies.gmail.createArchiveFilter(item.address)
      result = { address: item.address, outcome: "filtered", detail: filterId }
    } catch (error) {
      result = {
        address: item.address,
        outcome: "failed",
        detail: error instanceof Error ? error.message : String(error),
      }
    }
  }
  await appendJsonLine(logPath, {
    timestamp: dependencies.now().toISOString(),
    batch: batchId,
    sender: item.address,
    result: result.outcome,
    ...(result.outcome === "filtered" ? { filterId: result.detail } : { detail: result.detail }),
  })
  return result
}

/** Capture and describe a batch's Tasks item, resuming after a partial earlier attempt. */
async function ensureBatchTask(
  /** Batch ID. */
  batchId: string,
  /** Store path. */
  storePath: string,
  /** Tasks client. */
  tasks: EmailTasksClient,
): Promise<void> {
  let batch = requireOpenBatch(await loadProposalStore(storePath), batchId)
  if (!batch.task.taskId) {
    const taskId = await tasks.capture(
      batchTitle(batch),
      `email-processing:${batch.id}`,
      `email-processing:${batch.id}:capture`,
    )
    await updateProposalStore(storePath, store => {
      requireOpenBatch(store, batchId).task.taskId = taskId
    })
    batch = { ...batch, task: { ...batch.task, taskId } }
  }
  await tasks.saveDescription(
    batch.task.taskId!,
    describeBatch(batch),
    `email-processing:${batch.id}:description`,
  )
  await updateProposalStore(storePath, store => {
    requireOpenBatch(store, batchId).task.described = true
  })
}

/** Close a batch once every sender has a result, and complete its Tasks item. */
async function finishBatch(
  /** Batch ID. */
  batchId: string,
  /** Store path. */
  storePath: string,
  /** Tasks client. */
  dependencies: ProposalDependencies,
): Promise<void> {
  const batch = requireOpenBatch(await loadProposalStore(storePath), batchId)
  if (batch.task.taskId) {
    await dependencies.tasks.complete(batch.task.taskId, `email-processing:${batch.id}:complete`)
  }
  await updateProposalStore(storePath, store => {
    const current = requireOpenBatch(store, batchId)
    current.status = "done"
    current.closedAt = dependencies.now().toISOString()
  })
}

/** Name a batch's Tasks item. */
function batchTitle(
  /** Batch. */
  batch: ProposalBatch,
): string {
  const count = batch.items.length
  const senders = `${count} sender${count === 1 ? "" : "s"}`
  return batch.kind === "unsubscribe"
    ? `Approve unsubscribing from ${senders}`
    : `Approve Gmail filters for ${senders}`
}

/** Create a batch with a unique ID for the day. */
function createBatch(
  /** Kind of batch. */
  kind: ProposalKind,
  /** Proposed senders. */
  items: ProposalItem[],
  /** Current time. */
  now: Date,
  /** Store, for existing IDs. */
  store: ProposalStore,
): ProposalBatch {
  const base = `${kind}-${now.toISOString().slice(0, 10)}`
  const ids = new Set(store.batches.map(batch => batch.id))
  let id = base
  for (let suffix = 2; ids.has(id); suffix++) id = `${base}-${suffix}`
  return {
    id,
    kind,
    createdAt: now.toISOString(),
    status: "open",
    items,
    results: [],
    task: { described: false },
  }
}

/** Find a batch that is still open. */
function requireOpenBatch(
  /** Store. */
  store: ProposalStore,
  /** Batch ID. */
  batchId: string,
): ProposalBatch {
  const batch = store.batches.find(item => item.id === batchId)
  if (!batch) throw new Error(`No proposal batch named ${batchId}`)
  if (batch.status !== "open") throw new Error(`${batchId} is already done`)
  return batch
}

/** Read every address with an accepted or possibly accepted unsubscribe. */
async function loadUnsubscribedAddresses(
  /** Unsubscribe log path. */
  path: string,
): Promise<Set<string>> {
  const lines = await readLines(path)
  return new Set(
    lines.flatMap(line => {
      try {
        const record = JSON.parse(line) as { sender?: unknown; result?: unknown }
        return typeof record.sender === "string" &&
          (record.result === "accepted" || record.result === "uncertain")
          ? [record.sender.toLowerCase()]
          : []
      } catch {
        return []
      }
    }),
  )
}

/** Load the proposal store, or an empty one. */
export async function loadProposalStore(
  /** Store path. */
  path = defaultPaths().store,
): Promise<ProposalStore> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Partial<ProposalStore>
    return {
      pendingUnsubscribes: value.pendingUnsubscribes ?? {},
      batches: value.batches ?? [],
      declined: {
        unsubscribe: value.declined?.unsubscribe ?? [],
        filter: value.declined?.filter ?? [],
      },
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { pendingUnsubscribes: {}, batches: [], declined: { unsubscribe: [], filter: [] } }
    }
    throw error
  }
}

/**
 * Load, change and atomically save the store in one short step, so a scheduled run and an
 * approval running at the same time don't hold stale copies.
 */
async function updateProposalStore(
  /** Store path. */
  path: string,
  /** Change to apply in place. */
  change: (store: ProposalStore) => void,
): Promise<void> {
  const store = await loadProposalStore(path)
  change(store)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  await rename(temporaryPath, path)
}

/** Append one JSON record to a log file. */
async function appendJsonLine(
  /** Log path. */
  path: string,
  /** Record. */
  record: Record<string, unknown>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await appendFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 })
}

/** Read non-empty lines from a file that may not exist. */
async function readLines(
  /** File path. */
  path: string,
): Promise<string[]> {
  try {
    return (await readFile(path, "utf8")).split("\n").filter(line => line.trim())
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

/** Default data paths, outside the repository. */
function defaultPaths(): ProposalPaths {
  const share = join(homedir(), ".local", "share")
  return {
    store: join(share, "email-processing", "proposals.json"),
    filterLog: join(share, "email-processing", "filters.jsonl"),
    // Shared with the first hand-approved batches of 2026-11-06, so those senders are skipped.
    unsubscribeLog: join(share, "email-unsubscribe", "unsubscribes.jsonl"),
  }
}

// CONSTANTS

/** Classifications that say nothing about whether Herb wants mail from the sender. */
const NON_SENDER_CLASSIFICATIONS = new Set([
  "calendar-reply",
  "calendar-invitation",
  "auto-reply",
  "no-action",
])

// TYPES

/** The two kinds of change Herb approves. */
export type ProposalKind = "unsubscribe" | "filter"

/** One proposed sender. */
export type ProposalItem = {
  /** Exact lowercase sender address. */
  address: string
  /** Sender display name. */
  name: string
  /** Sanitized subject of a recent message. */
  sampleSubject: string
  /** One-click URL, for unsubscribes. */
  url?: string
  /** Archives in the window, for filters. */
  archives?: number
  /** Gmail message ID of the latest message. */
  messageId: string
  /** Gmail thread ID of the latest message. */
  threadId: string
  /** Receipt time of the latest message, for unsubscribes. */
  receivedAt?: string
}

/** What happened to one sender in an approved batch. */
export type ProposalResult = {
  /** Sender address. */
  address: string
  /** Outcome. */
  outcome: "unsubscribed" | "uncertain" | "failed" | "filtered" | "already-filtered" | "declined"
  /** HTTP status, filter ID or error. */
  detail: string
}

/** A set of senders Herb approves or declines together, with its Tasks item. */
export type ProposalBatch = {
  /** Batch ID, such as unsubscribe-2026-11-12. */
  id: string
  /** Kind of change. */
  kind: ProposalKind
  /** Creation time. */
  createdAt: string
  /** Open until approved or declined. */
  status: "open" | "done"
  /** When the batch was closed. */
  closedAt?: string
  /** Proposed senders. */
  items: ProposalItem[]
  /** Results recorded so far. */
  results: ProposalResult[]
  /** The batch's Tasks Inbox item. */
  task: { taskId?: string; described: boolean }
}

/** Durable proposal state. */
export type ProposalStore = {
  /** Unsubscribe candidates not yet in a batch, keyed by address. */
  pendingUnsubscribes: Record<string, UnsubscribeCandidate>
  /** All batches, open and done. */
  batches: ProposalBatch[]
  /** Senders Herb declined, never proposed again. */
  declined: Record<ProposalKind, string[]>
}

/** Data file locations. */
export type ProposalPaths = {
  /** Proposal store. */
  store: string
  /** Filter creation log. */
  filterLog: string
  /** One-click unsubscribe log. */
  unsubscribeLog: string
}

/** Boundaries for proposing and approving. */
export type ProposalDependencies = {
  /** Clock. */
  now: () => Date
  /** Gmail filter operations. */
  gmail: Pick<GmailClient, "listFilters" | "createArchiveFilter">
  /** Tasks board writes. */
  tasks: EmailTasksClient
  /** Fetch for one-click unsubscribe requests. */
  fetch: (url: URL, init: RequestInit) => Promise<Response>
  /** Decision log reader. */
  loadDecisionLog: () => Promise<DecisionLogEntry[]>
  /** Path overrides for tests. */
  paths?: Partial<ProposalPaths>
}
