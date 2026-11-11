import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { GmailRequest } from "../createGmailClient.ts"
import { loadJevApiKey, runEmailProcessingCommand } from "../runEmailProcessing.ts"
import type { GmailSupervisorDependencies } from "../supervisorTypes.ts"
import { archiveJev, keepJev, marketingJev } from "./jevFixtures.ts"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("runEmailProcessingCommand", () => {
  it("archives with Jev, verifies the change, prints counts and reruns idempotently", async () => {
    const context = await setup([createMessage({ id: "m1", threadId: "t1" })])

    const result = await context.run([], vi.fn().mockResolvedValue(archiveJev))
    await context.run([], vi.fn().mockResolvedValue(archiveJev))

    expect(result).toMatchObject({ archived: 1, retried: 0 })
    expect(context.mailbox.mutations).toEqual([
      { threadId: "t1", mutation: { addLabelIds: [], removeLabelIds: ["INBOX"] } },
    ])
    expect(context.lines[0]).toBe(
      "archived=1 promoted=0 unchanged=0 retried=0 pending=0 corrected=0",
    )
    const log = await context.readLog()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ decision: "archive", classification: "transactional" })
  })

  it("leaves Gmail unchanged in log-only mode and queues unsubscribes for approval", async () => {
    const context = await setup([createMessage({ id: "m1", threadId: "t1", oneClick: true })])

    const result = await context.run(["--log-only"], vi.fn().mockResolvedValue(marketingJev))

    expect(result).toMatchObject({ archived: 1 })
    expect(context.mailbox.mutations).toEqual([])
    expect(context.lines[0]).toMatch(/^mode=log-only archived=1 /)
    expect((await context.readLog())[0]).toMatchObject({ decision: "archive", logOnly: true })
    const store = JSON.parse(await readFile(context.paths.store, "utf8"))
    expect(store.pendingUnsubscribes["vendor@example.com"]).toMatchObject({
      url: "https://unsubscribe.example.com/u/1",
    })
  })

  it("keeps a sender's mail after Herb returns an archived thread to the inbox", async () => {
    const context = await setup([createMessage({ id: "m1", threadId: "t1" })])
    await context.run([], vi.fn().mockResolvedValue(archiveJev))

    context.mailbox.addInboxBack("m1")
    context.mailbox.addMessage(createMessage({ id: "m2", threadId: "t2" }))
    const result = await context.run([], vi.fn().mockResolvedValue(archiveJev))

    expect(result).toMatchObject({ corrected: 1, archived: 0, unchanged: 1 })
    const log = await context.readLog()
    expect(log.map(entry => entry.classification)).toEqual([
      "transactional",
      "archive-reversed",
      "archive-reversal",
    ])
  })

  it("fails closed when Jev fails, keeping the message for the next run", async () => {
    const context = await setup([createMessage({ id: "m1", threadId: "t1" })])
    const writeError = vi.fn()

    const result = await context.run(
      [],
      vi.fn().mockRejectedValue(new Error("Jev request failed with HTTP 529")),
      { writeError },
    )

    expect(result).toMatchObject({ archived: 0, retried: 1 })
    expect(context.mailbox.mutations).toEqual([])
    expect(writeError).toHaveBeenCalledWith(expect.stringContaining("HTTP 529"))
    const state = JSON.parse(await readFile(context.statePath, "utf8"))
    expect(state.retryMessageIds).toEqual(["m1"])
  })

  it("summarizes recent decisions with where each thread is now", async () => {
    const context = await setup([
      createMessage({ id: "m1", threadId: "t1" }),
      createMessage({ id: "m2", threadId: "t2", subject: "Lunch?" }),
    ])
    const classify = vi.fn(async ({ candidate }) =>
      candidate.messageId === "m1" ? archiveJev : keepJev,
    ) satisfies GmailSupervisorDependencies["classify"]
    await context.run(["run", "--log-only"], classify)
    context.mailbox.archive("t1")

    await context.run(["summary", "--hours", "1"])

    const summary = context.lines.at(-1)!
    expect(summary).toContain("(log-only)")
    expect(summary).toContain("would archive 1, would promote 0, would leave 1")
    expect(summary).toContain("Agrees with where Herb has left the thread for 2 of 2.")
    expect(summary).toContain("- Vendor Person <vendor@example.com> – Lunch? – in inbox")
  })

  it("cuts over at the current Gmail history position and discards existing retries", async () => {
    const context = await setup([])
    await writeFile(
      context.statePath,
      JSON.stringify({
        lastHistoryId: "100",
        lastCompletedAt: "2026-08-26T10:00:00.000Z",
        retryMessageIds: ["old-message"],
        archiveReversalSenders: ["protected@example.com"],
      }),
    )

    await context.run(["cutover"])

    expect(JSON.parse(await readFile(context.statePath, "utf8"))).toEqual({
      lastHistoryId: "105",
      lastCompletedAt: "2026-08-26T12:00:00.000Z",
      retryMessageIds: [],
      archiveReversalSenders: ["protected@example.com"],
    })
    expect(context.lines).toEqual(["cutover=ok"])
  })

  it("proposes queued unsubscribes as a Tasks item and carries out what Herb approved", async () => {
    const context = await setup([createMessage({ id: "m1", threadId: "t1", oneClick: true })])
    await context.run(["--log-only"], vi.fn().mockResolvedValue(marketingJev))

    await context.run(["propose"])
    await context.run(["approve", "unsubscribe-2026-08-26"])

    expect(context.tasks.capture).toHaveBeenCalledTimes(1)
    expect(context.fetch).toHaveBeenCalledTimes(1)
    expect(context.tasks.complete).toHaveBeenCalledWith(
      "task-1",
      "email-processing:unsubscribe-2026-08-26:complete",
    )
    expect(context.lines.slice(-2)).toEqual([
      "proposed unsubscribe-2026-08-26 senders=1",
      "unsubscribed vendor@example.com (HTTP 200)",
    ])
  })

  it("documents its commands and rejects unknown ones", async () => {
    const context = await setup([])

    await context.run(["help"])

    expect(context.lines.join("\n")).toContain("run [--log-only]")
    expect(context.lines.join("\n")).toContain("approve <batch>")
    await expect(context.run(["--preflight"])).rejects.toThrow("Unknown command")
  })
})

describe("loadJevApiKey", () => {
  it("prefers JEV_API_KEY and otherwise reads the export line in ~/.secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "jev-key-test-"))
    const secretsPath = join(directory, ".secrets")
    await writeFile(secretsPath, 'export OTHER=1\nexport JEV_API_KEY="from-file"\n')

    vi.stubEnv("JEV_API_KEY", "")
    await expect(loadJevApiKey(secretsPath)).resolves.toBe("from-file")
    vi.stubEnv("JEV_API_KEY", "from-env")
    await expect(loadJevApiKey(secretsPath)).resolves.toBe("from-env")
    vi.stubEnv("JEV_API_KEY", "")
    await expect(loadJevApiKey(join(directory, "missing"))).rejects.toThrow("JEV_API_KEY")
  })
})

/** Create temporary files and a fake mailbox, and a helper to run the command against them. */
async function setup(
  /** Messages that arrive after the saved history position. */
  messages: MessageFixture[],
) {
  const directory = await mkdtemp(join(tmpdir(), "email-processing-command-test-"))
  const statePath = join(directory, "state.json")
  const decisionLogPath = join(directory, "decisions.jsonl")
  const paths = {
    store: join(directory, "proposals.json"),
    filterLog: join(directory, "filters.jsonl"),
    unsubscribeLog: join(directory, "unsubscribes.jsonl"),
  }
  await writeFile(
    statePath,
    JSON.stringify({
      lastHistoryId: "100",
      lastCompletedAt: null,
      retryMessageIds: [],
      archiveReversalSenders: [],
    }),
  )
  const mailbox = createMailbox(messages)
  const lines: string[] = []
  const tasks = {
    capture: vi.fn().mockResolvedValue("task-1"),
    saveDescription: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
  }
  const fetch = vi
    .fn<(url: URL, init: RequestInit) => Promise<Response>>()
    .mockResolvedValue(new Response(null, { status: 200 }))
  return {
    mailbox,
    lines,
    tasks,
    fetch,
    paths,
    statePath,
    readLog: async () =>
      (await readFile(decisionLogPath, "utf8"))
        .trim()
        .split("\n")
        .map(line => JSON.parse(line) as Record<string, unknown>),
    run: (
      args: string[],
      classify?: GmailSupervisorDependencies["classify"],
      extra: { writeError?: (line: string) => void } = {},
    ) =>
      runEmailProcessingCommand({
        args,
        now: () => new Date("2026-08-26T12:00:00.000Z"),
        gmailRequest: mailbox.request,
        classify: classify ?? vi.fn().mockRejectedValue(new Error("Jev not expected")),
        tasks,
        fetch,
        statePath,
        decisionLogPath,
        proposalPaths: paths,
        writeLine: line => lines.push(line),
        writeError: extra.writeError ?? (() => {}),
      }),
  }
}

/** A fake Gmail API that tracks labels, label changes and history. */
function createMailbox(
  /** Initial messages, all reported as added after the saved history position. */
  initial: MessageFixture[],
) {
  const messages = new Map(initial.map(message => [message.id, message]))
  const mutations: {
    threadId: string
    mutation: { addLabelIds: string[]; removeLabelIds: string[] }
  }[] = []
  let history: Record<string, unknown> = {
    history: [
      {
        messagesAdded: initial.map(message => ({
          message: { id: message.id, threadId: message.threadId },
        })),
      },
    ],
  }
  const thread = (threadId: string) => ({
    id: threadId,
    messages: [...messages.values()].filter(message => message.threadId === threadId),
  })
  const relabel = (threadId: string, add: string[], remove: string[]) => {
    for (const message of messages.values()) {
      if (message.threadId !== threadId) continue
      message.labelIds = [...new Set([...message.labelIds, ...add])].filter(
        label => !remove.includes(label),
      )
    }
  }

  const request: GmailRequest = async ({ method, path, body }) => {
    const [resource, id, action] = path.split("/")
    if (path === "profile") return { emailAddress: "herb@devresults.com", historyId: "105" }
    if (path === "history") return history
    if (path === "labels") return { labels: [] }
    if (resource === "messages" && !id) return { messages: [] }
    if (resource === "messages") return messages.get(id!)
    if (resource === "threads" && method === "POST" && action === "modify") {
      const mutation = body as { addLabelIds: string[]; removeLabelIds: string[] }
      mutations.push({ threadId: id!, mutation })
      relabel(id!, mutation.addLabelIds, mutation.removeLabelIds)
      return {}
    }
    if (resource === "threads") return thread(id!)
    throw new Error(`Unexpected Gmail request: ${method} ${path}`)
  }

  return {
    request,
    mutations,
    /** Herb moves a message back to the inbox. */
    addInboxBack: (messageId: string) => {
      const message = messages.get(messageId)!
      relabel(message.threadId, ["INBOX"], [])
      history = {
        history: [{ labelsAdded: [{ message: { id: messageId }, labelIds: ["INBOX"] }] }],
      }
    },
    /** A new message arrives. */
    addMessage: (message: MessageFixture) => {
      messages.set(message.id, message)
      const current = (history.history as Record<string, unknown>[])[0]!
      current.messagesAdded = [{ message: { id: message.id, threadId: message.threadId } }]
    },
    /** Herb archives a thread himself. */
    archive: (threadId: string) => relabel(threadId, [], ["INBOX"]),
  }
}

/** Create one Gmail API message fixture. */
function createMessage(
  /** Fixture options. */
  options: {
    id: string
    threadId: string
    subject?: string
    oneClick?: boolean
  },
): MessageFixture {
  return {
    id: options.id,
    threadId: options.threadId,
    internalDate: "1787742000000",
    labelIds: ["INBOX", "CATEGORY_PERSONAL"],
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Vendor Person <vendor@example.com>" },
        { name: "To", value: "Herb Caudill <herb@devresults.com>" },
        { name: "Subject", value: options.subject ?? "Your receipt" },
        ...(options.oneClick
          ? [
              { name: "List-Unsubscribe", value: "<https://unsubscribe.example.com/u/1>" },
              { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
            ]
          : []),
      ],
      body: { data: Buffer.from("Thanks for your order.").toString("base64url") },
    },
  }
}

type MessageFixture = {
  id: string
  threadId: string
  internalDate: string
  labelIds: string[]
  payload: {
    mimeType: string
    headers: { name: string; value: string }[]
    body: { data: string }
  }
}
