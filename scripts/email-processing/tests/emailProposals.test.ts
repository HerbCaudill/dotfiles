import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  approveBatch,
  declineBatch,
  findFilterCandidates,
  isCoveredByFilter,
  loadProposalStore,
  proposeBatches,
  queueUnsubscribe,
  type ProposalDependencies,
} from "../emailProposals.ts"
import type { DecisionLogEntry, GmailFilter, UnsubscribeCandidate } from "../supervisorTypes.ts"

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true })))
})

describe("unsubscribe proposals", () => {
  it("batches queued senders into one Tasks Inbox item, skipping ones already unsubscribed", async () => {
    const { dependencies, paths, tasks } = await setup()
    await writeFile(
      paths.unsubscribeLog,
      `${JSON.stringify({ sender: "old@shop.example", result: "accepted" })}\n`,
    )
    await queueUnsubscribe(candidate("deals@shop.example", "Old subject"), paths.store)
    await queueUnsubscribe(candidate("deals@shop.example", "Save 20% today"), paths.store)
    await queueUnsubscribe(candidate("old@shop.example"), paths.store)

    const lines = await proposeBatches(dependencies)

    expect(lines).toEqual(["proposed unsubscribe-2026-11-12 senders=1"])
    expect(tasks.capture).toHaveBeenCalledWith(
      "Approve unsubscribing from 1 sender",
      "email-processing:unsubscribe-2026-11-12",
      "email-processing:unsubscribe-2026-11-12:capture",
    )
    const description = tasks.saveDescription.mock.calls[0]![1]
    expect(description).toContain("email-processing approve unsubscribe-2026-11-12")
    expect(description).toContain("Deals <deals@shop.example> – “Save 20% today”")
    const store = await loadProposalStore(paths.store)
    expect(store.pendingUnsubscribes).toEqual({ "old@shop.example": expect.anything() })
    expect(store.batches[0]).toMatchObject({
      status: "open",
      task: { taskId: "task-1", described: true },
    })
  })

  it("waits for Herb to deal with an open batch before proposing more", async () => {
    const { dependencies, paths, tasks } = await setup()
    await queueUnsubscribe(candidate("a@shop.example"), paths.store)
    await proposeBatches(dependencies)
    await queueUnsubscribe(candidate("b@shop.example"), paths.store)

    await expect(proposeBatches(dependencies)).resolves.toEqual(["proposed nothing"])
    expect(tasks.capture).toHaveBeenCalledTimes(1)
  })

  it("sends one-click requests for approved senders, remembers declined ones and completes the task", async () => {
    const { dependencies, paths, tasks, fetch } = await setup()
    await queueUnsubscribe(candidate("a@shop.example"), paths.store)
    await queueUnsubscribe(candidate("b@shop.example"), paths.store)
    await proposeBatches(dependencies)

    const lines = await approveBatch(dependencies, "unsubscribe-2026-11-12", ["B@shop.example"])

    expect(lines).toEqual(["unsubscribed a@shop.example (HTTP 202)", "declined b@shop.example"])
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]!
    expect(url.toString()).toBe("https://unsubscribe.example.com/a@shop.example")
    expect(init).toMatchObject({
      method: "POST",
      body: "List-Unsubscribe=One-Click",
      redirect: "manual",
    })
    expect(tasks.complete).toHaveBeenCalledWith(
      "task-1",
      "email-processing:unsubscribe-2026-11-12:complete",
    )
    const store = await loadProposalStore(paths.store)
    expect(store.batches[0]?.status).toBe("done")
    expect(store.declined.unsubscribe).toEqual(["b@shop.example"])
    const log = (await readFile(paths.unsubscribeLog, "utf8"))
      .trim()
      .split("\n")
      .map(line => JSON.parse(line))
    expect(log).toEqual([
      expect.objectContaining({
        list: "unsubscribe-2026-11-12",
        sender: "a@shop.example",
        endpointHost: "unsubscribe.example.com",
        result: "accepted",
        detail: "HTTP 202",
      }),
    ])

    await queueUnsubscribe(candidate("b@shop.example"), paths.store)
    await queueUnsubscribe(candidate("a@shop.example"), paths.store)
    await expect(proposeBatches(dependencies)).resolves.toEqual(["proposed nothing"])
  })

  it("rejects an exception that is not in the batch, and a batch that is already done", async () => {
    const { dependencies, paths, fetch } = await setup()
    await queueUnsubscribe(candidate("a@shop.example"), paths.store)
    await proposeBatches(dependencies)

    await expect(
      approveBatch(dependencies, "unsubscribe-2026-11-12", ["typo@shop.example"]),
    ).rejects.toThrow("Not in unsubscribe-2026-11-12: typo@shop.example")
    expect(fetch).not.toHaveBeenCalled()

    await declineBatch(dependencies, "unsubscribe-2026-11-12")
    await expect(approveBatch(dependencies, "unsubscribe-2026-11-12", [])).rejects.toThrow(
      "already done",
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("filter proposals", () => {
  it("proposes senders archived at least three times, never kept, restored or written to", () => {
    const decisions = [
      ...archives("promo@shop.example", 3),
      ...archives("twice@shop.example", 2),
      ...archives("mixed@shop.example", 3),
      entry("mixed@shop.example", { decision: "none" }),
      ...archives("person@example.com", 3, { jev: jev("personal") }),
      ...archives("written@example.com", 3, { policySignals: ["prior-reply"] }),
      ...archives("colleen@devresults.com", 3),
      ...archives("restored@shop.example", 3),
      entry("restored@shop.example", {
        decision: "correction",
        classification: "archive-reversed",
      }),
      ...archives("lynne@example.com", 3, { classification: "calendar-reply" }),
      ...archives("old@shop.example", 3, { timestamp: "2026-09-01T10:00:00.000Z" }),
    ]

    const candidates = findFilterCandidates(decisions, now)

    expect(candidates.map(item => item.address)).toEqual(["promo@shop.example"])
    expect(candidates[0]).toMatchObject({ name: "Sender", archives: 3, sampleSubject: "Subject 3" })
  })

  it("treats a sender as covered when a filter already skips the inbox for it or its domain", () => {
    const filters: GmailFilter[] = [
      { id: "1", from: "a@x.example OR b@y.example", removeLabelIds: ["INBOX"] },
      { id: "2", from: "z.example", removeLabelIds: ["INBOX"] },
      { id: "3", from: "label@only.example", removeLabelIds: [] },
    ]

    expect(isCoveredByFilter("b@y.example", filters)).toBe(true)
    expect(isCoveredByFilter("news@z.example", filters)).toBe(true)
    expect(isCoveredByFilter("label@only.example", filters)).toBe(false)
  })

  it("creates archive filters for approved senders and completes the task", async () => {
    const { dependencies, gmail, tasks } = await setup({
      decisions: [...archives("promo@shop.example", 3), ...archives("news@covered.example", 3)],
      filters: [{ id: "old", from: "covered.example", removeLabelIds: ["INBOX"] }],
    })

    await expect(proposeBatches(dependencies)).resolves.toEqual([
      "proposed filter-2026-11-12 senders=1",
    ])
    expect(tasks.capture).toHaveBeenCalledWith(
      "Approve Gmail filters for 1 sender",
      "email-processing:filter-2026-11-12",
      "email-processing:filter-2026-11-12:capture",
    )
    await expect(approveBatch(dependencies, "filter-2026-11-12", [])).resolves.toEqual([
      "filtered promo@shop.example (filter-new)",
    ])
    expect(gmail.createArchiveFilter).toHaveBeenCalledWith("promo@shop.example")
    expect(tasks.complete).toHaveBeenCalledTimes(1)
  })
})

/** Create temporary paths and fakes. */
async function setup(
  /** Decisions in the log and existing Gmail filters. */
  options: { decisions?: DecisionLogEntry[]; filters?: GmailFilter[] } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "email-proposals-test-"))
  directories.push(directory)
  const paths = {
    store: join(directory, "proposals.json"),
    filterLog: join(directory, "filters.jsonl"),
    unsubscribeLog: join(directory, "unsubscribes.jsonl"),
  }
  const tasks = {
    capture: vi.fn().mockResolvedValue("task-1"),
    saveDescription: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
  }
  const gmail = {
    listFilters: vi.fn().mockResolvedValue(options.filters ?? []),
    createArchiveFilter: vi.fn().mockResolvedValue("filter-new"),
  }
  const fetch = vi
    .fn<(url: URL, init: RequestInit) => Promise<Response>>()
    .mockResolvedValue(new Response(null, { status: 202 }))
  const dependencies: ProposalDependencies = {
    now: () => now,
    gmail,
    tasks,
    fetch,
    loadDecisionLog: async () => options.decisions ?? [],
    paths,
  }
  return { dependencies, paths, tasks, gmail, fetch }
}

/** A queued unsubscribe candidate. */
function candidate(
  /** Sender address. */
  address: string,
  /** Sample subject. */
  sampleSubject = "Sale",
): UnsubscribeCandidate {
  return {
    address,
    name: "Deals",
    sampleSubject,
    url: `https://unsubscribe.example.com/${address}`,
    messageId: `m-${address}`,
    threadId: `t-${address}`,
    receivedAt: "2026-11-11T10:00:00.000Z",
  }
}

/** Several archive decisions for one sender. */
function archives(
  /** Sender address. */
  address: string,
  /** Number of archives. */
  count: number,
  /** Overrides for each entry. */
  overrides: Partial<DecisionLogEntry> = {},
): DecisionLogEntry[] {
  return Array.from({ length: count }, (_, index) =>
    entry(address, {
      messageId: `${address}-${index}`,
      subject: `Subject ${index + 1}`,
      ...overrides,
    }),
  )
}

/** One decision for a sender. */
function entry(
  /** Sender address. */
  address: string,
  /** Overrides. */
  overrides: Partial<DecisionLogEntry> = {},
): DecisionLogEntry {
  return {
    policyVersion: "sha256:test",
    timestamp: "2026-11-10T10:00:00.000Z",
    messageId: `${address}-m`,
    threadId: `${address}-t`,
    sender: `Sender <${address}>`,
    subject: "Subject",
    originalLabels: ["INBOX"],
    decision: "archive",
    classification: "transactional",
    confidence: "high",
    reason: "Jev: archive.",
    policySignals: ["transactional"],
    jev: jev("transactional"),
    gmailUrl: "https://mail.google.com/mail/#all/t",
    ...overrides,
  }
}

/** A Jev log summary for a mail kind. */
function jev(
  /** Mail kind. */
  mailKind: string,
): DecisionLogEntry["jev"] {
  return { model: "jev-test", mailKind, marketing: 0, keep: 0.05 }
}

const now = new Date("2026-11-12T05:30:00.000Z")
