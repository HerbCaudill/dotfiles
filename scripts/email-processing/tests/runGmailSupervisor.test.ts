import { describe, expect, it, vi } from "vitest"

import { MAX_ACTIONS_PER_RUN } from "../constants.ts"
import { runGmailSupervisor } from "../runGmailSupervisor.ts"
import type { ClassifierInput } from "../types.ts"
import type {
  DecisionLogEntry,
  EmailProcessingState,
  GmailClient,
  GmailMessage,
  GmailThread,
} from "../supervisorTypes.ts"
import { ExpiredGmailHistoryError } from "../supervisorTypes.ts"
import { validArchiveOutput, validNoneOutput, validPromoteOutput } from "./classifierFixtures.ts"

const inboxMessage: GmailMessage = {
  id: "message-1",
  threadId: "thread-1",
  labelIds: ["INBOX", "CATEGORY_PERSONAL"],
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: "Vendor Person <vendor@example.com>" },
      { name: "To", value: "Herb Caudill <herb@devresults.com>" },
      { name: "Subject", value: "A proposal" },
    ],
    body: { data: Buffer.from("Would you like to buy our software?").toString("base64url") },
  },
}

const inboxThread: GmailThread = {
  id: "thread-1",
  historyId: "101",
  messages: [inboxMessage],
}

const emptyState: EmailProcessingState = {
  lastHistoryId: null,
  lastCompletedAt: null,
  retryMessageIds: [],
  archiveReversalSenders: [],
}

describe("runGmailSupervisor", () => {
  it("discovers the previous seven days on the first run and saves the profile history ID", async () => {
    const appendDecision = vi.fn<(entry: DecisionLogEntry) => Promise<void>>().mockResolvedValue()
    const saveState = vi.fn<(state: EmailProcessingState) => Promise<void>>().mockResolvedValue()
    const gmail = createGmailClient()
    const classify = vi.fn().mockResolvedValue(validNoneOutput)

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify,
      loadState: async () => emptyState,
      saveState,
      loadDecisionLog: async () => [],
      appendDecision,
    })

    expect(gmail.listRecentInboxMessages).toHaveBeenCalledWith(new Date("2026-08-19T12:00:00.000Z"))
    expect(gmail.listHistory).not.toHaveBeenCalled()
    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [
        expect.objectContaining({
          messageId: "message-1",
          threadId: "thread-1",
          subject: "A proposal",
          body: "Would you like to buy our software?",
          category: "primary",
        }),
      ],
    })
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-1",
        decision: "none",
        originalLabels: ["INBOX", "CATEGORY_PERSONAL"],
      }),
    )
    expect(saveState).toHaveBeenCalledWith({
      lastHistoryId: "105",
      lastCompletedAt: "2026-08-26T12:00:00.000Z",
      retryMessageIds: [],
      archiveReversalSenders: [],
    })
    expect(result).toEqual({
      archived: 0,
      promoted: 0,
      unchanged: 1,
      retried: 0,
      pending: 0,
      corrected: 0,
    })
  })

  it("uses incremental history and idempotently skips a message already in the decision log", async () => {
    const oldEntry = createLogEntry({ messageId: "message-1" })
    const incrementalMessage = createMessage({ id: "message-2", threadId: "thread-2" })
    const gmail = createGmailClient({
      listHistory: vi.fn().mockResolvedValue({
        addedMessages: [
          { messageId: "message-1", threadId: "thread-1" },
          { messageId: "message-2", threadId: "thread-2" },
        ],
        labelChanges: [],
      }),
      getMessage: vi.fn().mockResolvedValue(incrementalMessage),
      getThread: vi.fn().mockResolvedValue({
        id: "thread-2",
        messages: [incrementalMessage],
      }),
    })
    const classify = vi.fn().mockResolvedValue({
      decisions: [{ ...validNoneOutput.decisions[0], messageId: "message-2" }],
    })

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify,
      loadState: async () => ({ ...emptyState, lastHistoryId: "100" }),
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [oldEntry],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(gmail.listHistory).toHaveBeenCalledWith("100")
    expect(gmail.listRecentInboxMessages).not.toHaveBeenCalled()
    expect(gmail.getMessage).toHaveBeenCalledTimes(1)
    expect(gmail.getMessage).toHaveBeenCalledWith("message-2")
  })

  it("plans one classification for the newest discovered message in each Gmail thread", async () => {
    const olderMessage = createMessage({ id: "message-1", threadId: "shared-thread" })
    const newerMessage = createMessage({ id: "message-2", threadId: "shared-thread" })
    const gmail = createGmailClient({
      listRecentInboxMessages: vi.fn().mockResolvedValue([
        { messageId: "message-1", threadId: "shared-thread" },
        { messageId: "message-2", threadId: "shared-thread" },
      ]),
      getMessage: vi.fn().mockResolvedValueOnce(olderMessage).mockResolvedValueOnce(newerMessage),
      getThread: vi.fn().mockResolvedValue({
        id: "shared-thread",
        messages: [olderMessage, newerMessage],
      }),
    })
    const classify = vi.fn(async (input: ClassifierInput) => ({
      decisions: input.candidates.map(candidate => ({
        ...validNoneOutput.decisions[0],
        messageId: candidate.messageId,
      })),
    }))

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [expect.objectContaining({ messageId: "message-2", threadId: "shared-thread" })],
    })
  })

  it("falls back from expired history and skips decisions already logged", async () => {
    const fallbackMessage = createMessage({ id: "message-2", threadId: "thread-2" })
    const gmail = createGmailClient({
      listHistory: vi.fn().mockRejectedValue(new ExpiredGmailHistoryError()),
      listRecentInboxMessages: vi.fn().mockResolvedValue([
        { messageId: "message-1", threadId: "thread-1" },
        { messageId: "message-2", threadId: "thread-2" },
      ]),
      getMessage: vi.fn().mockResolvedValue(fallbackMessage),
      getThread: vi.fn().mockResolvedValue({ id: "thread-2", messages: [fallbackMessage] }),
    })

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue({
        decisions: [{ ...validNoneOutput.decisions[0], messageId: "message-2" }],
      }),
      loadState: async () => ({ ...emptyState, lastHistoryId: "expired" }),
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [createLogEntry({ messageId: "message-1" })],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(gmail.listRecentInboxMessages).toHaveBeenCalledWith(new Date("2026-08-19T12:00:00.000Z"))
    expect(gmail.getMessage).toHaveBeenCalledWith("message-2")
  })

  it("recognizes archive, promotion, and missed-promotion corrections", async () => {
    const appendDecision = vi.fn().mockResolvedValue(undefined)
    const saveState = vi.fn().mockResolvedValue(undefined)
    const gmail = createGmailClient({
      listHistory: vi.fn().mockResolvedValue({
        addedMessages: [],
        labelChanges: [
          { messageId: "archived", addedLabelIds: ["INBOX"], removedLabelIds: [] },
          {
            messageId: "promoted",
            addedLabelIds: ["CATEGORY_UPDATES"],
            removedLabelIds: ["CATEGORY_PERSONAL"],
          },
          {
            messageId: "untouched",
            addedLabelIds: ["STARRED", "CATEGORY_PERSONAL"],
            removedLabelIds: ["CATEGORY_UPDATES"],
          },
        ],
      }),
    })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn(),
      loadState: async () => ({ ...emptyState, lastHistoryId: "100" }),
      saveState,
      loadDecisionLog: async () => [
        createLogEntry({
          messageId: "archived",
          decision: "archive",
          sender: "Vendor <vendor@example.com>",
        }),
        createLogEntry({ messageId: "promoted", decision: "promote" }),
        createLogEntry({
          messageId: "untouched",
          decision: "none",
          originalLabels: ["INBOX", "CATEGORY_UPDATES"],
        }),
      ],
      appendDecision,
    })

    expect(appendDecision.mock.calls.map(([entry]) => entry.classification)).toEqual([
      "archive-reversed",
      "promotion-reversed",
      "promotion-missed",
    ])
    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({ archiveReversalSenders: ["vendor@example.com"] }),
    )
    expect(result.corrected).toBe(3)
  })

  it("reconstructs archive-reversal protection from the durable correction log", async () => {
    const decisionLog = [
      createLogEntry({
        messageId: "archived",
        decision: "archive",
        sender: "Vendor Person <vendor@example.com>",
      }),
    ]
    const appendDecision = vi.fn(async (entry: DecisionLogEntry) => {
      decisionLog.push(entry)
    })
    const firstGmail = createGmailClient({
      listHistory: vi.fn().mockResolvedValue({
        addedMessages: [],
        labelChanges: [{ messageId: "archived", addedLabelIds: ["INBOX"], removedLabelIds: [] }],
      }),
    })

    await expect(
      runGmailSupervisor({
        now: () => new Date("2026-08-26T12:00:00.000Z"),
        gmail: firstGmail,
        classify: vi.fn(),
        loadState: async () => ({ ...emptyState, lastHistoryId: "100" }),
        saveState: vi.fn().mockRejectedValue(new Error("state unavailable")),
        loadDecisionLog: async () => decisionLog,
        appendDecision,
      }),
    ).rejects.toThrow("state unavailable")

    const classify = vi.fn().mockResolvedValue(validNoneOutput)
    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:05:00.000Z"),
      gmail: createGmailClient(),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => decisionLog,
      appendDecision,
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [
        expect.objectContaining({
          archiveProtections: expect.objectContaining({ archiveReversal: true }),
        }),
      ],
    })
  })

  it("supplies promotion corrections recorded in the current history window", async () => {
    const currentMessage = createMessage({ id: "message-2", threadId: "thread-2" })
    const classify = vi.fn().mockResolvedValue({
      decisions: [{ ...validNoneOutput.decisions[0], messageId: "message-2" }],
    })

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listHistory: vi.fn().mockResolvedValue({
          addedMessages: [{ messageId: "message-2", threadId: "thread-2" }],
          labelChanges: [
            {
              messageId: "untouched",
              addedLabelIds: ["CATEGORY_PERSONAL"],
              removedLabelIds: ["CATEGORY_UPDATES"],
            },
          ],
        }),
        getMessage: vi.fn().mockResolvedValue(currentMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-2", messages: [currentMessage] }),
      }),
      classify,
      loadState: async () => ({ ...emptyState, lastHistoryId: "100" }),
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [
        createLogEntry({
          messageId: "untouched",
          decision: "none",
          originalLabels: ["INBOX", "CATEGORY_UPDATES"],
          sender: "Colleague <colleague@example.com>",
          subject: "Approval needed",
        }),
      ],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [
        expect.objectContaining({
          promotionCorrections: [
            expect.objectContaining({
              correction: "promotion-missed",
              sender: { name: "Colleague", address: "colleague@example.com" },
              subject: "Approval needed",
            }),
          ],
        }),
      ],
    })
  })

  it("supplies prior promotion corrections as bounded evidence for future classifications", async () => {
    const classify = vi.fn().mockResolvedValue(validNoneOutput)

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient(),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [
        createLogEntry({
          timestamp: "2026-08-24T12:00:00.000Z",
          messageId: "reversed-message",
          decision: "correction",
          classification: "promotion-reversed",
          sender: "Vendor Person <vendor@example.com>",
          subject: "Routine vendor update",
        }),
        createLogEntry({
          timestamp: "2026-08-25T12:00:00.000Z",
          messageId: "missed-message",
          decision: "correction",
          classification: "promotion-missed",
          sender: "Colleague <colleague@example.com>",
          subject: "Approval needed",
        }),
      ],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [
        expect.objectContaining({
          promotionCorrections: [
            {
              timestamp: "2026-08-24T12:00:00.000Z",
              correction: "promotion-reversed",
              sender: { name: "Vendor Person", address: "vendor@example.com" },
              subject: "Routine vendor update",
              exactSender: true,
            },
            {
              timestamp: "2026-08-25T12:00:00.000Z",
              correction: "promotion-missed",
              sender: { name: "Colleague", address: "colleague@example.com" },
              subject: "Approval needed",
              exactSender: false,
            },
          ],
        }),
      ],
    })
  })

  it("applies and verifies only the exact archive thread mutation", async () => {
    const getThread = vi
      .fn()
      .mockResolvedValueOnce(inboxThread)
      .mockResolvedValueOnce({
        ...inboxThread,
        messages: [{ ...inboxMessage, labelIds: ["CATEGORY_PERSONAL"] }],
      })
    const gmail = createGmailClient({ getThread })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(validArchiveOutput),
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(gmail.modifyThreadLabels).toHaveBeenCalledWith("thread-1", {
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    })
    expect(getThread).toHaveBeenCalledTimes(2)
    expect(result.archived).toBe(1)
  })

  it("applies and verifies only the exact promotion thread mutation", async () => {
    const promotionsMessage = createMessage({
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    })
    const promotedMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PERSONAL"] })
    const gmail = createGmailClient({
      getMessage: vi.fn().mockResolvedValue(promotionsMessage),
      getThread: vi
        .fn()
        .mockResolvedValueOnce({ id: "thread-1", messages: [promotionsMessage] })
        .mockResolvedValueOnce({ id: "thread-1", messages: [promotedMessage] }),
    })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(validPromoteOutput),
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(gmail.modifyThreadLabels).toHaveBeenCalledWith("thread-1", {
      addLabelIds: ["CATEGORY_PERSONAL"],
      removeLabelIds: [
        "CATEGORY_UPDATES",
        "CATEGORY_PROMOTIONS",
        "CATEGORY_SOCIAL",
        "CATEGORY_FORUMS",
      ],
    })
    expect(result.promoted).toBe(1)
  })

  it("rejects promotion verification when Inbox was not retained", async () => {
    const promotionsMessage = createMessage({
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    })
    const missingInboxMessage = createMessage({ labelIds: ["CATEGORY_PERSONAL"] })
    const appendDecision = vi.fn().mockResolvedValue(undefined)
    const gmail = createGmailClient({
      getMessage: vi.fn().mockResolvedValue(promotionsMessage),
      getThread: vi
        .fn()
        .mockResolvedValueOnce({ id: "thread-1", messages: [promotionsMessage] })
        .mockResolvedValueOnce({ id: "thread-1", messages: [missingInboxMessage] }),
    })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(validPromoteOutput),
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision,
    })

    expect(result).toMatchObject({ promoted: 0, retried: 1 })
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "error", classification: "promote-error" }),
    )
  })

  it("does not require Sent messages to retain Inbox during promotion verification", async () => {
    const promotionsMessage = createMessage({
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    })
    const sentMessage = createMessage({
      id: "sent-message",
      labelIds: ["SENT", "CATEGORY_PERSONAL"],
    })
    const promotedMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PERSONAL"] })
    const gmail = createGmailClient({
      getMessage: vi.fn().mockResolvedValue(promotionsMessage),
      getThread: vi
        .fn()
        .mockResolvedValueOnce({ id: "thread-1", messages: [promotionsMessage, sentMessage] })
        .mockResolvedValueOnce({ id: "thread-1", messages: [promotedMessage, sentMessage] }),
    })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(validPromoteOutput),
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(result).toMatchObject({ promoted: 1, retried: 0 })
  })

  it("requires Inbox retention only on the target inbound message during promotion verification", async () => {
    const promotionsMessage = createMessage({
      id: "target-message",
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    })
    const olderReceivedMessage = createMessage({
      id: "older-message",
      labelIds: ["CATEGORY_PERSONAL"],
    })
    const promotedMessage = createMessage({
      id: "target-message",
      labelIds: ["INBOX", "CATEGORY_PERSONAL"],
    })
    const gmail = createGmailClient({
      listRecentInboxMessages: vi
        .fn()
        .mockResolvedValue([{ messageId: "target-message", threadId: "thread-1" }]),
      getMessage: vi.fn().mockResolvedValue(promotionsMessage),
      getThread: vi
        .fn()
        .mockResolvedValueOnce({
          id: "thread-1",
          messages: [olderReceivedMessage, promotionsMessage],
        })
        .mockResolvedValueOnce({
          id: "thread-1",
          messages: [olderReceivedMessage, promotedMessage],
        }),
    })
    const output = {
      decisions: [{ ...validPromoteOutput.decisions[0], messageId: "target-message" }],
    }

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(output),
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(result).toMatchObject({ promoted: 1, retried: 0 })
  })

  it("retries a mutation when post-write labels do not match the exact plan", async () => {
    const appendDecision = vi.fn().mockResolvedValue(undefined)
    const saveState = vi.fn().mockResolvedValue(undefined)
    const gmail = createGmailClient({
      getThread: vi.fn().mockResolvedValue(inboxThread),
    })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(validArchiveOutput),
      loadState: async () => emptyState,
      saveState,
      loadDecisionLog: async () => [],
      appendDecision,
    })

    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "error",
        classification: "archive-error",
      }),
    )
    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({ retryMessageIds: ["message-1"] }),
    )
    expect(result.archived).toBe(0)
  })

  it("persists a retry checkpoint when a verified mutation cannot be appended to the log", async () => {
    const verifiedThread = {
      ...inboxThread,
      messages: [{ ...inboxMessage, labelIds: ["CATEGORY_PERSONAL"] }],
    }
    const gmail = createGmailClient({
      getThread: vi.fn().mockResolvedValueOnce(inboxThread).mockResolvedValueOnce(verifiedThread),
    })
    const saveState = vi.fn().mockResolvedValue(undefined)

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(validArchiveOutput),
      loadState: async () => emptyState,
      saveState,
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockRejectedValue(new Error("decision log unavailable")),
    })

    expect(saveState).toHaveBeenNthCalledWith(1, {
      ...emptyState,
      retryMessageIds: ["message-1"],
      retryOriginalLabelIds: {
        "message-1": ["INBOX", "CATEGORY_PERSONAL"],
      },
    })
    expect(result).toMatchObject({ archived: 0, retried: 1 })
  })

  it("continues after a partial Gmail failure and saves the failed message for retry", async () => {
    const secondMessage = createMessage({ id: "message-2", threadId: "thread-2" })
    const getMessage = vi
      .fn()
      .mockResolvedValueOnce(inboxMessage)
      .mockResolvedValueOnce(secondMessage)
    const getThread = vi
      .fn()
      .mockResolvedValueOnce(inboxThread)
      .mockResolvedValueOnce({ id: "thread-2", messages: [secondMessage] })
      .mockResolvedValueOnce({
        id: "thread-2",
        messages: [{ ...secondMessage, labelIds: ["CATEGORY_PERSONAL"] }],
      })
    const modifyThreadLabels = vi
      .fn()
      .mockRejectedValueOnce(new Error("access token 123456 secret@example.com"))
      .mockResolvedValueOnce(undefined)
    const saveState = vi.fn().mockResolvedValue(undefined)
    const appendDecision = vi.fn().mockResolvedValue(undefined)
    const gmail = createGmailClient({
      listRecentInboxMessages: vi.fn().mockResolvedValue([
        { messageId: "message-1", threadId: "thread-1" },
        { messageId: "message-2", threadId: "thread-2" },
      ]),
      getMessage,
      getThread,
      modifyThreadLabels,
    })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue({
        decisions: [
          validArchiveOutput.decisions[0],
          { ...validArchiveOutput.decisions[0], messageId: "message-2" },
        ],
      }),
      loadState: async () => emptyState,
      saveState,
      loadDecisionLog: async () => [],
      appendDecision,
    })

    expect(result).toEqual({
      archived: 1,
      promoted: 0,
      unchanged: 0,
      retried: 1,
      pending: 0,
      corrected: 0,
    })
    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({ retryMessageIds: ["message-1"] }),
    )
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-1",
        decision: "error",
        reason: "Gmail mutation failed",
      }),
    )
    expect(JSON.stringify(appendDecision.mock.calls)).not.toContain("123456")
    expect(JSON.stringify(appendDecision.mock.calls)).not.toContain("secret@example.com")
  })

  it("retries a failed message even when an earlier error is already logged", async () => {
    const gmail = createGmailClient()
    const saveState = vi.fn().mockResolvedValue(undefined)

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue(validNoneOutput),
      loadState: async () => ({ ...emptyState, retryMessageIds: ["message-1"] }),
      saveState,
      loadDecisionLog: async () => [createLogEntry({ messageId: "message-1", decision: "error" })],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(gmail.getMessage).toHaveBeenCalledWith("message-1")
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ retryMessageIds: [] }))
  })

  it("does not let an error log suppress a retry when durable state was not saved", async () => {
    const classify = vi.fn().mockResolvedValue(validNoneOutput)
    const archivedMessage = createMessage({ labelIds: ["CATEGORY_PERSONAL"] })

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi.fn().mockResolvedValue([]),
        getMessage: vi.fn().mockResolvedValue(archivedMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [archivedMessage] }),
      }),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [
        createLogEntry({
          messageId: "message-1",
          decision: "error",
          classification: "archive-error",
        }),
      ],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledTimes(1)
  })

  it("uses current Gmail labels for retries after failures that did not mutate Gmail", async () => {
    const promotionsMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] })
    const classify = vi.fn().mockResolvedValue(validNoneOutput)

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi.fn().mockResolvedValue([]),
        getMessage: vi.fn().mockResolvedValue(promotionsMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [promotionsMessage] }),
      }),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [
        createLogEntry({
          decision: "error",
          classification: "processing-error",
          originalLabels: ["INBOX", "CATEGORY_PERSONAL"],
        }),
      ],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [expect.objectContaining({ category: "promotions" })],
    })
  })

  it("completes a classifier-only retry without action after it leaves Inbox", async () => {
    const archivedMessage = createMessage({ labelIds: ["IMPORTANT", "CATEGORY_UPDATES"] })
    const classify = vi.fn().mockResolvedValue(validPromoteOutput)
    const appendDecision = vi.fn().mockResolvedValue(undefined)
    const saveState = vi.fn().mockResolvedValue(undefined)

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi.fn().mockResolvedValue([]),
        getMessage: vi.fn().mockResolvedValue(archivedMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [archivedMessage] }),
      }),
      classify,
      loadState: async () => ({ ...emptyState, retryMessageIds: ["message-1"] }),
      saveState,
      loadDecisionLog: async () => [
        createLogEntry({
          decision: "error",
          classification: "processing-error",
          originalLabels: ["INBOX", "CATEGORY_UPDATES"],
        }),
      ],
      appendDecision,
    })

    expect(classify).not.toHaveBeenCalled()
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-1",
        originalLabels: ["IMPORTANT", "CATEGORY_UPDATES"],
        decision: "none",
        classification: "no-action",
        reason: "Message left Inbox before retry; no action taken.",
      }),
    )
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
    expect(result).toMatchObject({ unchanged: 1, retried: 0 })
  })

  it("does not checkpoint stale labels when logging a no-action decision fails", async () => {
    let persistedState = emptyState
    const saveState = vi.fn(async (state: EmailProcessingState) => {
      persistedState = state
    })

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient(),
      classify: vi.fn().mockResolvedValue(validNoneOutput),
      loadState: async () => emptyState,
      saveState,
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockRejectedValue(new Error("decision log unavailable")),
    })

    const promotionsMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] })
    const classify = vi.fn().mockResolvedValue(validNoneOutput)
    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:05:00.000Z"),
      gmail: createGmailClient({
        getMessage: vi.fn().mockResolvedValue(promotionsMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [promotionsMessage] }),
      }),
      classify,
      loadState: async () => persistedState,
      saveState,
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [expect.objectContaining({ category: "promotions" })],
    })
  })

  it("does not retain an older thread retry after a newer message completes", async () => {
    const olderMessage = createMessage({ id: "message-1", threadId: "shared-thread" })
    const newerMessage = createMessage({ id: "message-2", threadId: "shared-thread" })
    const saveState = vi.fn().mockResolvedValue(undefined)
    const classify = vi.fn(async (input: ClassifierInput) => ({
      decisions: input.candidates.map(candidate => ({
        ...validNoneOutput.decisions[0],
        messageId: candidate.messageId,
      })),
    }))

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi
          .fn()
          .mockResolvedValue([{ messageId: "message-2", threadId: "shared-thread" }]),
        getMessage: vi
          .fn()
          .mockImplementation(async id => (id === "message-1" ? olderMessage : newerMessage)),
        getThread: vi.fn().mockResolvedValue({
          id: "shared-thread",
          messages: [olderMessage, newerMessage],
        }),
      }),
      classify,
      loadState: async () => ({ ...emptyState, retryMessageIds: ["message-1"] }),
      saveState,
      loadDecisionLog: async () => [
        createLogEntry({
          messageId: "message-1",
          threadId: "shared-thread",
          decision: "error",
          classification: "processing-error",
        }),
      ],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledTimes(1)
    expect(classify.mock.calls[0]?.[0].candidates.map(candidate => candidate.messageId)).toEqual([
      "message-2",
    ])
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
  })

  it("finishes an idempotent promotion retry when labels changed before verification failed", async () => {
    const promotedMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PERSONAL"] })
    const classify = vi.fn().mockResolvedValue(validPromoteOutput)
    const gmail = createGmailClient({
      getMessage: vi.fn().mockResolvedValue(promotedMessage),
      getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [promotedMessage] }),
    })
    const saveState = vi.fn().mockResolvedValue(undefined)

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify,
      loadState: async () => ({ ...emptyState, retryMessageIds: ["message-1"] }),
      saveState,
      loadDecisionLog: async () => [
        createLogEntry({
          decision: "error",
          classification: "promote-error",
          originalLabels: ["INBOX", "CATEGORY_PROMOTIONS"],
        }),
      ],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [expect.objectContaining({ category: "promotions" })],
    })
    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(saveState).toHaveBeenCalledWith(expect.objectContaining({ retryMessageIds: [] }))
    expect(result.promoted).toBe(1)
  })

  it("redacts secrets from subjects, reasons, and policy signals before logging", async () => {
    const secretMessage = createMessage({
      subject: "Login code 123456 for account 987654321",
      body: "The body must never be logged, including private-body-token.",
    })
    const appendDecision = vi.fn().mockResolvedValue(undefined)
    const gmail = createGmailClient({
      getMessage: vi.fn().mockResolvedValue(secretMessage),
      getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [secretMessage] }),
    })

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue({
        decisions: [
          {
            ...validNoneOutput.decisions[0],
            reason: "The one-time password is 123456 and token sk-secret1234567890.",
            policySignals: ["account-987654321"],
          },
        ],
      }),
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision,
    })

    const serializedLog = JSON.stringify(appendDecision.mock.calls)
    expect(serializedLog).not.toContain("123456")
    expect(serializedLog).not.toContain("987654321")
    expect(serializedLog).not.toContain("sk-secret1234567890")
    expect(serializedLog).not.toContain("private-body-token")
    expect(serializedLog).toContain("[REDACTED]")
  })

  it("supplies complete inline body, thread context, exact prior replies, and objective policy facts", async () => {
    const priorMessage = createMessage({ id: "prior", threadId: "thread-1" })
    priorMessage.payload = {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Herb Caudill <herb@devresults.com>" },
        { name: "To", value: "Vendor Person <vendor@example.com>" },
        { name: "Subject", value: "Requested demo" },
      ],
      body: { data: Buffer.from("Please send details.").toString("base64url") },
    }
    const multipartMessage = createMessage({
      subject: "Demo request",
      body: "ignored top-level body",
    })
    multipartMessage.payload = {
      mimeType: "multipart/mixed",
      headers: [
        { name: "From", value: "Vendor Person <vendor@example.com>" },
        {
          name: "To",
          value: "Herb Caudill <herb@devresults.com>, Colleen <colleen@devresults.com>",
        },
        { name: "Subject", value: "Demo request" },
      ],
      parts: [
        {
          mimeType: "text/plain",
          body: {
            data: Buffer.from(
              "We would like a DevResults demo. Herb, please reply with a time.",
            ).toString("base64url"),
          },
        },
        {
          mimeType: "text/plain",
          filename: "secret.txt",
          body: {
            attachmentId: "attachment-1",
            data: Buffer.from("attachment contents").toString("base64url"),
          },
        },
      ],
    }
    const hasPriorReplyTo = vi.fn().mockResolvedValue(true)
    const classify = vi.fn().mockResolvedValue(validNoneOutput)
    const gmail = createGmailClient({
      getMessage: vi.fn().mockResolvedValue(multipartMessage),
      getThread: vi.fn().mockResolvedValue({
        id: "thread-1",
        messages: [priorMessage, multipartMessage],
      }),
      hasPriorReplyTo,
    })

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(hasPriorReplyTo).toHaveBeenCalledWith("vendor@example.com")
    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [
        expect.objectContaining({
          body: "We would like a DevResults demo. Herb, please reply with a time.",
          thread: [
            expect.objectContaining({
              sender: { name: "Herb Caudill", address: "herb@devresults.com" },
              body: "Please send details.",
            }),
          ],
          archiveProtections: expect.objectContaining({
            priorReply: true,
            activeConversation: true,
            requestedWork: true,
            herbInitiated: true,
          }),
          delegatedCustomer: {
            customerInquiry: true,
            otherDevResultsRecipient: true,
            requiresHerbAction: true,
          },
        }),
      ],
    })
    expect(JSON.stringify(classify.mock.calls)).not.toContain("attachment contents")
  })

  it("protects an exact sender previously classified as a personal correspondent", async () => {
    const classify = vi.fn().mockResolvedValue(validNoneOutput)

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient(),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [
        createLogEntry({
          messageId: "earlier-message",
          decision: "promote",
          classification: "personal-message",
          sender: "Vendor Person <vendor@example.com>",
        }),
      ],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [
        expect.objectContaining({
          archiveProtections: expect.objectContaining({ protectedCorrespondent: true }),
        }),
      ],
    })
  })

  it.each([
    {
      name: "family or friends",
      message: createMessage({ body: "As your cousin, I wanted to check in about the family." }),
      priorMessages: [],
    },
    {
      name: "medical providers",
      message: createMessage({ subject: "Appointment with your cardiologist" }),
      priorMessages: [],
    },
    {
      name: "requested contractors",
      message: createMessage({ body: "I can repair the roof next week." }),
      priorMessages: [
        createMessage({
          id: "sent-message",
          body: "Please repair the roof and send me the estimate.",
          from: "Herb Caudill <herb@devresults.com>",
        }),
      ],
    },
  ])("protects $name without a prior qualifying promotion", async ({ message, priorMessages }) => {
    const classify = vi.fn().mockResolvedValue(validNoneOutput)

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        getMessage: vi.fn().mockResolvedValue(message),
        getThread: vi.fn().mockResolvedValue({
          id: message.threadId,
          messages: [...priorMessages, message],
        }),
      }),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [
        expect.objectContaining({
          archiveProtections: expect.objectContaining({ protectedCorrespondent: true }),
        }),
      ],
    })
  })

  it("rejects classifier output that names an unsupplied pending candidate", async () => {
    const messages = Array.from({ length: MAX_ACTIONS_PER_RUN + 1 }, (_, index) =>
      createMessage({ id: `message-${index}`, threadId: `thread-${index}` }),
    )
    const gmail = createGmailClient({
      listRecentInboxMessages: vi
        .fn()
        .mockResolvedValue(
          messages.map(message => ({ messageId: message.id, threadId: message.threadId })),
        ),
      getMessage: vi.fn().mockImplementation(async id => messages.find(item => item.id === id)),
      getThread: vi.fn().mockImplementation(async id => ({
        id,
        messages: [messages.find(item => item.threadId === id)],
      })),
    })
    const appendDecision = vi.fn().mockResolvedValue(undefined)

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify: vi.fn().mockResolvedValue({
        decisions: messages.map(message => ({
          ...validArchiveOutput.decisions[0],
          messageId: message.id,
        })),
      }),
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision,
    })

    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(result).toMatchObject({ retried: MAX_ACTIONS_PER_RUN, pending: 1 })
    expect(appendDecision).toHaveBeenCalledTimes(MAX_ACTIONS_PER_RUN)
  })

  it("processes at most ten backlog messages and reports untouched work as pending", async () => {
    const messages = Array.from({ length: 101 }, (_, index) =>
      createMessage({ id: `message-${index}`, threadId: `thread-${index}` }),
    )
    const classify = vi.fn(async (input: ClassifierInput) => ({
      decisions: input.candidates.map(candidate => ({
        ...validNoneOutput.decisions[0],
        messageId: candidate.messageId,
      })),
    }))

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi
          .fn()
          .mockResolvedValue(
            messages.map(message => ({ messageId: message.id, threadId: message.threadId })),
          ),
        getMessage: vi.fn().mockImplementation(async id => messages.find(item => item.id === id)!),
        getThread: vi.fn().mockImplementation(async id => ({
          id,
          messages: [messages.find(item => item.threadId === id)!],
        })),
      }),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify.mock.calls.map(([input]) => input.candidates.length)).toEqual([10])
    expect(result).toMatchObject({ unchanged: 10, retried: 0, pending: 91 })
  })

  it("isolates candidates that exceed per-field classifier schema limits", async () => {
    const invalidBody = createMessage({
      id: "invalid-body",
      threadId: "thread-invalid-body",
      body: "x".repeat(100_001),
    })
    const invalidSubject = createMessage({
      id: "invalid-subject",
      threadId: "thread-invalid-subject",
      subject: "x".repeat(2_001),
    })
    const validMessage = createMessage({ id: "valid", threadId: "thread-valid" })
    const messages = [invalidBody, invalidSubject, validMessage]
    const classify = vi.fn(async (input: ClassifierInput) => ({
      decisions: input.candidates.map(candidate => ({
        ...validNoneOutput.decisions[0],
        messageId: candidate.messageId,
      })),
    }))
    const appendDecision = vi.fn().mockResolvedValue(undefined)

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi
          .fn()
          .mockResolvedValue(
            messages.map(message => ({ messageId: message.id, threadId: message.threadId })),
          ),
        getMessage: vi.fn().mockImplementation(async id => messages.find(item => item.id === id)!),
        getThread: vi.fn().mockImplementation(async id => ({
          id,
          messages: [messages.find(item => item.threadId === id)!],
        })),
      }),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision,
    })

    expect(classify).toHaveBeenCalledWith({
      account: "herb@devresults.com",
      candidates: [expect.objectContaining({ messageId: "valid" })],
    })
    expect(appendDecision.mock.calls.map(([entry]) => entry.messageId)).toEqual([
      "invalid-body",
      "invalid-subject",
      "valid",
    ])
    expect(result).toMatchObject({ unchanged: 1, retried: 2 })
  })

  it("keeps the bounded run input below one megabyte", async () => {
    const messages = Array.from({ length: 12 }, (_, index) =>
      createMessage({
        id: `message-${index}`,
        threadId: `thread-${index}`,
        body: "x".repeat(90_000),
      }),
    )
    const classify = vi.fn(async (input: ClassifierInput) => ({
      decisions: input.candidates.map(candidate => ({
        ...validNoneOutput.decisions[0],
        messageId: candidate.messageId,
      })),
    }))

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi
          .fn()
          .mockResolvedValue(
            messages.map(message => ({ messageId: message.id, threadId: message.threadId })),
          ),
        getMessage: vi.fn().mockImplementation(async id => messages.find(item => item.id === id)!),
        getThread: vi.fn().mockImplementation(async id => ({
          id,
          messages: [messages.find(item => item.threadId === id)!],
        })),
      }),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledTimes(1)
    for (const [input] of classify.mock.calls) {
      expect(Buffer.byteLength(JSON.stringify(input), "utf8")).toBeLessThanOrEqual(1_000_000)
    }
    expect(result).toMatchObject({ unchanged: 10, retried: 0, pending: 2 })
  })

  it("drops only oldest thread context when one candidate exceeds the input byte limit", async () => {
    const currentMessage = createMessage({ id: "current-message" })
    const priorMessages = Array.from({ length: 12 }, (_, index) =>
      createMessage({
        id: `prior-${index}`,
        body: String.fromCharCode("a".charCodeAt(0) + index).repeat(90_000),
      }),
    )
    const classify = vi.fn().mockImplementation(async (input: ClassifierInput) => ({
      decisions: input.candidates.map(candidate => ({
        ...validNoneOutput.decisions[0],
        messageId: candidate.messageId,
      })),
    }))

    await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail: createGmailClient({
        listRecentInboxMessages: vi
          .fn()
          .mockResolvedValue([{ messageId: currentMessage.id, threadId: currentMessage.threadId }]),
        getMessage: vi.fn().mockResolvedValue(currentMessage),
        getThread: vi.fn().mockResolvedValue({
          id: currentMessage.threadId,
          messages: [...priorMessages, currentMessage],
        }),
      }),
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    const input = classify.mock.calls[0]?.[0]
    expect(Buffer.byteLength(JSON.stringify(input), "utf8")).toBeLessThanOrEqual(1_000_000)
    expect(input.candidates[0]?.thread.at(-1)?.body).toBe("l".repeat(90_000))
    expect(input.candidates[0]?.thread.length).toBeLessThan(priorMessages.length)
  })

  it("never offers the classifier more candidates than the run action cap", async () => {
    const messages = Array.from({ length: 101 }, (_, index) =>
      createMessage({ id: `message-${index}`, threadId: `thread-${index}` }),
    )
    const classify = vi.fn(async (input: ClassifierInput) => ({
      decisions: input.candidates.map(candidate => {
        const index = Number(candidate.messageId.slice("message-".length))
        return {
          ...(index < 11 || index === 100
            ? validArchiveOutput.decisions[0]
            : validNoneOutput.decisions[0]),
          messageId: candidate.messageId,
        }
      }),
    }))
    const gmail = createGmailClient({
      listRecentInboxMessages: vi
        .fn()
        .mockResolvedValue(
          messages.map(message => ({ messageId: message.id, threadId: message.threadId })),
        ),
      getMessage: vi.fn().mockImplementation(async id => messages.find(item => item.id === id)!),
      getThread: vi.fn().mockImplementation(async id => ({
        id,
        messages: [messages.find(item => item.threadId === id)!],
      })),
    })

    const result = await runGmailSupervisor({
      now: () => new Date("2026-08-26T12:00:00.000Z"),
      gmail,
      classify,
      loadState: async () => emptyState,
      saveState: vi.fn().mockResolvedValue(undefined),
      loadDecisionLog: async () => [],
      appendDecision: vi.fn().mockResolvedValue(undefined),
    })

    expect(classify).toHaveBeenCalledTimes(1)
    expect(classify.mock.calls[0]?.[0].candidates).toHaveLength(MAX_ACTIONS_PER_RUN)
    expect(gmail.modifyThreadLabels).toHaveBeenCalledTimes(MAX_ACTIONS_PER_RUN)
    expect(result).toMatchObject({ archived: 0, retried: 10, pending: 91 })
  })
})

/** Create a fake Gmail boundary with safe defaults for supervisor tests. */
function createGmailClient(
  /** Per-test Gmail behavior overrides. */
  overrides: Partial<GmailClient> = {},
): GmailClient {
  return {
    getProfile: vi.fn().mockResolvedValue({ historyId: "105" }),
    listRecentInboxMessages: vi
      .fn()
      .mockResolvedValue([{ messageId: "message-1", threadId: "thread-1" }]),
    listHistory: vi.fn().mockResolvedValue({ addedMessages: [], labelChanges: [] }),
    getMessage: vi.fn().mockResolvedValue(inboxMessage),
    getThread: vi.fn().mockResolvedValue(inboxThread),
    hasPriorReplyTo: vi.fn().mockResolvedValue(false),
    modifyThreadLabels: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

/** Create a Gmail message fixture with optional identity, labels, and text. */
function createMessage(
  /** Fixture overrides. */
  overrides: {
    /** Gmail message ID. */
    id?: string
    /** Gmail thread ID. */
    threadId?: string
    /** Current label IDs. */
    labelIds?: string[]
    /** Subject header. */
    subject?: string
    /** Inline text body. */
    body?: string
    /** From header. */
    from?: string
  } = {},
): GmailMessage {
  return {
    ...inboxMessage,
    id: overrides.id ?? inboxMessage.id,
    threadId: overrides.threadId ?? inboxMessage.threadId,
    labelIds: overrides.labelIds ?? inboxMessage.labelIds,
    payload: {
      ...inboxMessage.payload,
      headers: inboxMessage.payload?.headers?.map(header =>
        header.name === "Subject"
          ? { ...header, value: overrides.subject ?? header.value }
          : header.name === "From"
            ? { ...header, value: overrides.from ?? header.value }
            : header,
      ),
      body: {
        data: Buffer.from(overrides.body ?? "Would you like to buy our software?").toString(
          "base64url",
        ),
      },
    },
  }
}

/** Create a sanitized prior decision fixture. */
function createLogEntry(
  /** Fixture overrides. */
  overrides: Partial<DecisionLogEntry> = {},
): DecisionLogEntry {
  return {
    timestamp: "2026-08-25T12:00:00.000Z",
    messageId: "message-1",
    threadId: "thread-1",
    sender: "Vendor Person <vendor@example.com>",
    subject: "A proposal",
    originalLabels: ["INBOX", "CATEGORY_PERSONAL"],
    decision: "none",
    classification: "no-action",
    confidence: "low",
    reason: "No action required.",
    policySignals: ["routine"],
    gmailUrl: "https://mail.google.com/mail/#all/thread-1",
    ...overrides,
  }
}
