import { describe, expect, it, vi } from "vitest"

import type { JevClassification, JevClassifyInput } from "../classifyWithJev.ts"
import { MAX_ACTIONS_PER_RUN } from "../constants.ts"
import { runGmailSupervisor } from "../runGmailSupervisor.ts"
import type {
  DecisionLogEntry,
  EmailProcessingState,
  GmailClient,
  GmailMessage,
  GmailSupervisorDependencies,
  GmailThread,
} from "../supervisorTypes.ts"
import { ExpiredGmailHistoryError } from "../supervisorTypes.ts"
import { archiveJev, jevResult, keepJev, marketingJev } from "./jevFixtures.ts"

describe("runGmailSupervisor", () => {
  it("starts at the current Gmail history position without processing existing mail", async () => {
    const { gmail, classify, appendDecision, saveState, result } = await supervise({
      state: uninitializedState,
    })

    expect(gmail.listHistory).not.toHaveBeenCalled()
    expect(gmail.getMessage).not.toHaveBeenCalled()
    expect(classify).not.toHaveBeenCalled()
    expect(appendDecision).not.toHaveBeenCalled()
    expect(saveState).toHaveBeenCalledWith({
      lastHistoryId: "105",
      lastCompletedAt: "2026-08-26T12:00:00.000Z",
      retryMessageIds: [],
      archiveReversalSenders: [],
    })
    expect(result).toEqual({
      archived: 0,
      promoted: 0,
      unchanged: 0,
      retried: 0,
      pending: 0,
      corrected: 0,
    })
  })

  it("uses incremental history and skips a message already in the decision log", async () => {
    const incrementalMessage = createMessage({ id: "message-2", threadId: "thread-2" })
    const { gmail } = await supervise({
      gmail: {
        listHistory: vi.fn().mockResolvedValue({
          addedMessages: [
            { messageId: "message-1", threadId: "thread-1" },
            { messageId: "message-2", threadId: "thread-2" },
          ],
          labelChanges: [],
        }),
        getMessage: vi.fn().mockResolvedValue(incrementalMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-2", messages: [incrementalMessage] }),
      },
      log: [createLogEntry({ messageId: "message-1" })],
    })

    expect(gmail.listHistory).toHaveBeenCalledWith("100")
    expect(gmail.getMessage).toHaveBeenCalledTimes(1)
    expect(gmail.getMessage).toHaveBeenCalledWith("message-2")
  })

  it("classifies only the newest discovered message in each thread, with trusted receipt times", async () => {
    const olderMessage = createMessage({
      id: "message-1",
      threadId: "shared-thread",
      internalDate: "1787738400000",
    })
    const newerMessage = createMessage({ id: "message-2", threadId: "shared-thread" })
    const { classify } = await supervise({
      gmail: {
        listHistory: history(["message-1", "shared-thread"], ["message-2", "shared-thread"]),
        getMessage: vi.fn().mockResolvedValueOnce(olderMessage).mockResolvedValueOnce(newerMessage),
        getThread: vi.fn().mockResolvedValue({
          id: "shared-thread",
          messages: [olderMessage, newerMessage],
        }),
      },
    })

    expect(classify).toHaveBeenCalledTimes(1)
    expect(classify).toHaveBeenCalledWith({
      evaluatedAt: "2026-08-26T12:00:00.000Z",
      candidate: expect.objectContaining({
        messageId: "message-2",
        receivedAt: "2026-08-26T11:00:00.000Z",
        thread: [expect.objectContaining({ receivedAt: "2026-08-26T10:00:00.000Z" })],
      }),
    })
  })

  it("starts a fresh checkpoint without backfilling when Gmail history has expired", async () => {
    const { gmail, saveState } = await supervise({
      gmail: { listHistory: vi.fn().mockRejectedValue(new ExpiredGmailHistoryError()) },
      state: { ...emptyState, lastHistoryId: "expired" },
    })

    expect(gmail.getMessage).not.toHaveBeenCalled()
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ lastHistoryId: "105" }))
  })

  it("does not recover logged retries at or before the saved checkpoint", async () => {
    const { gmail, saveState } = await supervise({
      gmail: { listHistory: history() },
      state: { ...emptyState, lastCompletedAt: "2026-08-26T11:00:00.000Z" },
      log: [
        createLogEntry({
          timestamp: "2026-08-26T10:00:00.000Z",
          decision: "error",
          classification: "processing-error",
        }),
      ],
    })

    expect(gmail.getMessage).not.toHaveBeenCalled()
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
  })

  it("recognizes archive, promotion and missed-promotion corrections", async () => {
    const { appendDecision, saveState, result } = await supervise({
      gmail: {
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
      },
      log: [
        createLogEntry({ messageId: "archived", decision: "archive" }),
        createLogEntry({
          messageId: "promoted",
          decision: "promote",
          classification: "operational-failure",
          reason: "Jev: keep (keep 0.9, notification).",
          policySignals: ["notification"],
        }),
        createLogEntry({
          messageId: "untouched",
          decision: "none",
          originalLabels: ["INBOX", "CATEGORY_UPDATES"],
        }),
      ],
    })

    expect(appendDecision.mock.calls.map(([entry]) => entry.classification)).toEqual([
      "archive-reversed",
      "promotion-reversed",
      "promotion-missed",
    ])
    expect(appendDecision.mock.calls[1]?.[0]).toMatchObject({
      priorClassification: "operational-failure",
      priorReason: "Jev: keep (keep 0.9, notification).",
      priorPolicySignals: ["notification"],
    })
    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({ archiveReversalSenders: ["vendor@example.com"] }),
    )
    expect(result.corrected).toBe(3)
  })

  it("does not treat a log-only archive as something Herb reversed", async () => {
    const { appendDecision, result } = await supervise({
      gmail: {
        listHistory: vi.fn().mockResolvedValue({
          addedMessages: [],
          labelChanges: [{ messageId: "archived", addedLabelIds: ["INBOX"], removedLabelIds: [] }],
        }),
      },
      log: [createLogEntry({ messageId: "archived", decision: "archive", logOnly: true })],
    })

    expect(appendDecision).not.toHaveBeenCalled()
    expect(result.corrected).toBe(0)
  })

  it("keeps a sender's mail after Herb undoes an archive, even when the state save failed", async () => {
    const decisionLog = [createLogEntry({ messageId: "archived", decision: "archive" })]
    const appendDecision = vi.fn(async (entry: DecisionLogEntry) => {
      decisionLog.push(entry)
    })
    await expect(
      supervise({
        gmail: {
          listHistory: vi.fn().mockResolvedValue({
            addedMessages: [],
            labelChanges: [
              { messageId: "archived", addedLabelIds: ["INBOX"], removedLabelIds: [] },
            ],
          }),
        },
        saveState: vi.fn().mockRejectedValue(new Error("state unavailable")),
        log: decisionLog,
        appendDecision,
      }),
    ).rejects.toThrow("state unavailable")

    const { classify, gmail, result } = await supervise({
      log: decisionLog,
      appendDecision,
      classify: vi.fn().mockResolvedValue(archiveJev),
    })

    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate: expect.objectContaining({
          archiveProtections: expect.objectContaining({ archiveReversal: true }),
        }),
      }),
    )
    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(result.unchanged).toBe(1)
  })

  it("archives what Jev says Herb would archive, verifies the change and logs the decision", async () => {
    const { gmail, appendDecision, result } = await supervise({
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: {
        getThread: vi
          .fn()
          .mockResolvedValueOnce(inboxThread)
          .mockResolvedValueOnce(threadWithLabels(["CATEGORY_PERSONAL"])),
      },
    })

    expect(gmail.modifyThreadLabels).toHaveBeenCalledWith("thread-1", {
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    })
    expect(gmail.getThread).toHaveBeenCalledTimes(2)
    expect(result.archived).toBe(1)
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        policyVersion: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        decision: "archive",
        classification: "transactional",
        confidence: "high",
        jev: { model: "jev-test", mailKind: "transactional", marketing: 0, keep: 0.05 },
        unsubscribe: { eligible: false, blockedBy: ["not-marketing", "no-one-click"] },
        policySignals: ["transactional"],
      }),
    )
  })

  it("promotes what Jev says Herb keeps when it arrived outside Primary", async () => {
    const promotionsMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] })
    const { gmail, appendDecision, result } = await supervise({
      classify: vi.fn().mockResolvedValue(keepJev),
      gmail: {
        getMessage: vi.fn().mockResolvedValue(promotionsMessage),
        getThread: vi
          .fn()
          .mockResolvedValueOnce({ id: "thread-1", messages: [promotionsMessage] })
          .mockResolvedValueOnce(threadWithLabels(["INBOX", "CATEGORY_PERSONAL"])),
      },
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
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "promote", classification: "explicit-action" }),
    )
  })

  it("leaves what Jev says Herb keeps alone when it is already in Primary", async () => {
    const { gmail, result } = await supervise({ classify: vi.fn().mockResolvedValue(keepJev) })

    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(result.unchanged).toBe(1)
  })

  it("records decisions without changing Gmail in log-only mode", async () => {
    const queueUnsubscribe = vi.fn().mockResolvedValue(undefined)
    const { gmail, appendDecision, saveState, result } = await supervise({
      logOnly: true,
      classify: vi.fn().mockResolvedValue(marketingJev),
      gmail: {
        getMessage: vi.fn().mockResolvedValue(oneClickMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [oneClickMessage] }),
      },
      queueUnsubscribe,
    })

    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "archive", classification: "marketing", logOnly: true }),
    )
    expect(queueUnsubscribe).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ archived: 1, retried: 0 })
    expect(saveState).toHaveBeenCalledTimes(1)
    expect(saveState).toHaveBeenLastCalledWith(
      expect.objectContaining({ lastHistoryId: "105", retryMessageIds: [] }),
    )
  })

  it("queues a one-click unsubscribe for archived marketing", async () => {
    const queueUnsubscribe = vi.fn().mockResolvedValue(undefined)
    await supervise({
      classify: vi.fn().mockResolvedValue(marketingJev),
      gmail: {
        getMessage: vi.fn().mockResolvedValue(oneClickMessage),
        getThread: vi
          .fn()
          .mockResolvedValueOnce({ id: "thread-1", messages: [oneClickMessage] })
          .mockResolvedValueOnce(threadWithLabels([])),
      },
      queueUnsubscribe,
    })

    expect(queueUnsubscribe).toHaveBeenCalledWith({
      address: "vendor@example.com",
      name: "Vendor Person",
      sampleSubject: "A proposal",
      url: "https://unsubscribe.example.com/u/abc",
      messageId: "message-1",
      threadId: "thread-1",
      receivedAt: "2026-08-26T11:00:00.000Z",
    })
  })

  it("does not queue an unsubscribe when the sender offers no one-click link", async () => {
    const queueUnsubscribe = vi.fn().mockResolvedValue(undefined)
    await supervise({ classify: vi.fn().mockResolvedValue(marketingJev), queueUnsubscribe })

    expect(queueUnsubscribe).not.toHaveBeenCalled()
  })

  it("never archives mail from a devresults.com sender", async () => {
    const colleagueMessage = createMessage({ from: "Colleen <colleen@devresults.com>" })
    const { gmail, appendDecision, result } = await supervise({
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: {
        getMessage: vi.fn().mockResolvedValue(colleagueMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [colleagueMessage] }),
      },
    })

    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(result.unchanged).toBe(1)
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "none", classification: "devresults-sender" }),
    )
  })

  it("leaves mail with Herb's Keep label alone", async () => {
    const keptMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_UPDATES", "Label_42"] })
    const { gmail, appendDecision } = await supervise({
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: {
        getLabelIdByName: vi.fn().mockResolvedValue("Label_42"),
        getMessage: vi.fn().mockResolvedValue(keptMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [keptMessage] }),
      },
    })

    expect(gmail.getLabelIdByName).toHaveBeenCalledWith("Keep")
    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "none", classification: "keep-label" }),
    )
  })

  it("reads the calendar method from an attached invitation and keeps the invitation", async () => {
    const invitation = createMessage({})
    invitation.payload = {
      mimeType: "multipart/mixed",
      headers: inboxMessage.payload!.headers,
      parts: [
        { mimeType: "text/plain", body: { data: encode("You are invited.") } },
        { mimeType: "text/calendar", filename: "invite.ics", body: { attachmentId: "ics-1" } },
      ],
    }
    const getAttachmentData = vi
      .fn()
      .mockResolvedValue(encode("BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\n"))
    const { classify, gmail, appendDecision } = await supervise({
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: {
        getMessage: vi.fn().mockResolvedValue(invitation),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [invitation] }),
        getAttachmentData,
      },
    })

    expect(getAttachmentData).toHaveBeenCalledWith("message-1", "ics-1")
    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate: expect.objectContaining({ calendarMethod: "REQUEST" }),
      }),
    )
    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ classification: "calendar-invitation" }),
    )
  })

  it("supplies the body, thread, relationship facts and bulk-mail headers, but no attachments", async () => {
    const priorMessage = createMessage({ id: "prior" })
    priorMessage.payload = {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Herb Caudill <herb@devresults.com>" },
        { name: "To", value: "Vendor Person <vendor@example.com>" },
        { name: "Subject", value: "Requested demo" },
      ],
      body: { data: encode("Please send details.") },
    }
    const currentMessage = createMessage({})
    currentMessage.payload = {
      mimeType: "multipart/mixed",
      headers: [
        ...inboxMessage.payload!.headers!,
        { name: "List-Id", value: "<news.example.com>" },
        { name: "List-Unsubscribe", value: "<mailto:u@example.com>" },
        { name: "Auto-Submitted", value: "auto-replied" },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: encode("Here are the details you asked for.") } },
        {
          mimeType: "text/plain",
          filename: "secret.txt",
          body: { attachmentId: "attachment-1", data: encode("attachment contents") },
        },
      ],
    }
    const hasPriorReplyTo = vi.fn().mockResolvedValue(true)
    const { classify } = await supervise({
      gmail: {
        getMessage: vi.fn().mockResolvedValue(currentMessage),
        getThread: vi.fn().mockResolvedValue({
          id: "thread-1",
          messages: [priorMessage, currentMessage],
        }),
        hasPriorReplyTo,
      },
    })

    expect(hasPriorReplyTo).toHaveBeenCalledWith("vendor@example.com")
    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate: expect.objectContaining({
          body: "Here are the details you asked for.",
          thread: [
            expect.objectContaining({
              sender: { name: "Herb Caudill", address: "herb@devresults.com" },
              body: "Please send details.",
            }),
          ],
          archiveProtections: {
            priorReply: true,
            archiveReversal: false,
            activeConversation: true,
            requestedWork: true,
            herbInitiated: true,
          },
          bulkMail: {
            listId: "<news.example.com>",
            listUnsubscribe: true,
            oneClickUnsubscribeUrl: null,
          },
          autoReply: true,
          keepLabeled: false,
          calendarMethod: null,
        }),
      }),
    )
    expect(JSON.stringify(classify.mock.calls)).not.toContain("attachment contents")
  })

  it("redacts secrets and sign-in codes from logged subjects", async () => {
    const secretMessage = createMessage({
      subject: "Login code 123456 for account 987654321, key AB12-CD34",
      body: "The body must never be logged, including private-body-token.",
    })
    const { appendDecision } = await supervise({
      logOnly: true,
      classify: vi.fn().mockResolvedValue(jevResult({ routine: 0.9 })),
      gmail: {
        getMessage: vi.fn().mockResolvedValue(secretMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [secretMessage] }),
      },
    })

    const serializedLog = JSON.stringify(appendDecision.mock.calls)
    expect(serializedLog).not.toContain("123456")
    expect(serializedLog).not.toContain("987654321")
    expect(serializedLog).not.toContain("AB12-CD34")
    expect(serializedLog).not.toContain("private-body-token")
  })

  it("logs a Jev failure and retries the message, continuing with the others", async () => {
    const secondMessage = createMessage({ id: "message-2", threadId: "thread-2" })
    const classify = vi
      .fn<(input: JevClassifyInput) => Promise<JevClassification>>()
      .mockRejectedValueOnce(new Error("Jev request failed with HTTP 529"))
      .mockResolvedValueOnce(keepJev)
    const { appendDecision, saveState, result } = await supervise({
      classify,
      gmail: {
        listHistory: history(["message-1", "thread-1"], ["message-2", "thread-2"]),
        getMessage: vi.fn(async id => (id === "message-1" ? inboxMessage : secondMessage)),
        getThread: vi.fn(async id =>
          id === "thread-1" ? inboxThread : { id: "thread-2", messages: [secondMessage] },
        ),
      },
    })

    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-1",
        decision: "error",
        reason: "Classifier failed",
        exception: expect.stringContaining("HTTP 529"),
      }),
    )
    expect(result).toMatchObject({ unchanged: 1, retried: 1 })
    expect(saveState).toHaveBeenLastCalledWith(
      expect.objectContaining({ retryMessageIds: ["message-1"] }),
    )
  })

  it("rejects promotion verification when Inbox was not retained", async () => {
    const promotionsMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] })
    const { appendDecision, result } = await supervise({
      classify: vi.fn().mockResolvedValue(keepJev),
      gmail: {
        getMessage: vi.fn().mockResolvedValue(promotionsMessage),
        getThread: vi
          .fn()
          .mockResolvedValueOnce({ id: "thread-1", messages: [promotionsMessage] })
          .mockResolvedValueOnce(threadWithLabels(["CATEGORY_PERSONAL"])),
      },
    })

    expect(result).toMatchObject({ promoted: 0, retried: 1 })
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "error", classification: "promote-error" }),
    )
  })

  it("requires Inbox retention only on the target inbound message when promoting", async () => {
    const promotionsMessage = createMessage({
      id: "target",
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    })
    const sentMessage = createMessage({ id: "sent", labelIds: ["SENT", "CATEGORY_PERSONAL"] })
    const olderMessage = createMessage({ id: "older", labelIds: ["CATEGORY_PERSONAL"] })
    const promotedMessage = createMessage({
      id: "target",
      labelIds: ["INBOX", "CATEGORY_PERSONAL"],
    })
    const { result } = await supervise({
      classify: vi.fn().mockResolvedValue(keepJev),
      gmail: {
        listHistory: history(["target", "thread-1"]),
        getMessage: vi.fn().mockResolvedValue(promotionsMessage),
        getThread: vi
          .fn()
          .mockResolvedValueOnce({
            id: "thread-1",
            messages: [olderMessage, sentMessage, promotionsMessage],
          })
          .mockResolvedValueOnce({
            id: "thread-1",
            messages: [olderMessage, sentMessage, promotedMessage],
          }),
      },
    })

    expect(result).toMatchObject({ promoted: 1, retried: 0 })
  })

  it("retries a change when post-write labels do not match the plan", async () => {
    const { appendDecision, saveState, result } = await supervise({
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: { getThread: vi.fn().mockResolvedValue(inboxThread) },
    })

    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "error", classification: "archive-error" }),
    )
    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({ retryMessageIds: ["message-1"] }),
    )
    expect(result.archived).toBe(0)
  })

  it("persists a retry checkpoint when a verified change cannot be logged", async () => {
    const { saveState, result } = await supervise({
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: {
        getThread: vi
          .fn()
          .mockResolvedValueOnce(inboxThread)
          .mockResolvedValueOnce(threadWithLabels(["CATEGORY_PERSONAL"])),
      },
      appendDecision: vi.fn().mockRejectedValue(new Error("decision log unavailable")),
    })

    expect(saveState).toHaveBeenNthCalledWith(1, {
      ...emptyState,
      retryMessageIds: ["message-1"],
      retryOriginalLabelIds: { "message-1": ["INBOX", "CATEGORY_PERSONAL"] },
    })
    expect(result).toMatchObject({ archived: 0, retried: 1 })
  })

  it("continues after a partial Gmail failure and logs its full exception for retry", async () => {
    const secondMessage = createMessage({ id: "message-2", threadId: "thread-2" })
    const { appendDecision, saveState, result } = await supervise({
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: {
        listHistory: history(["message-1", "thread-1"], ["message-2", "thread-2"]),
        getMessage: vi.fn(async id => (id === "message-1" ? inboxMessage : secondMessage)),
        getThread: vi
          .fn()
          .mockResolvedValueOnce(inboxThread)
          .mockResolvedValueOnce({ id: "thread-2", messages: [secondMessage] })
          .mockResolvedValueOnce({
            id: "thread-2",
            messages: [{ ...secondMessage, labelIds: ["CATEGORY_PERSONAL"] }],
          }),
        modifyThreadLabels: vi
          .fn()
          .mockRejectedValueOnce(new Error("access token 123456 secret@example.com"))
          .mockResolvedValueOnce(undefined),
      },
    })

    expect(result).toEqual({
      archived: 1,
      promoted: 0,
      unchanged: 0,
      retried: 1,
      pending: 0,
      corrected: 0,
    })
    expect(saveState).toHaveBeenLastCalledWith(
      expect.objectContaining({ retryMessageIds: ["message-1"] }),
    )
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: "message-1",
        decision: "error",
        reason: "Gmail mutation failed",
      }),
    )
    expect(JSON.stringify(appendDecision.mock.calls)).toContain("secret@example.com")
  })

  it("persists the full exception when candidate inspection fails", async () => {
    const inspectionError = Object.assign(
      new Error("Gmail GET messages failed", { cause: new Error("socket closed unexpectedly") }),
      { responseText: "raw Gmail diagnostic", status: 500 },
    )
    const { appendDecision, result } = await supervise({
      gmail: { getMessage: vi.fn().mockRejectedValue(inspectionError) },
    })

    expect(result).toMatchObject({ retried: 1 })
    const exception = appendDecision.mock.calls[0]?.[0].exception
    expect(appendDecision.mock.calls[0]?.[0]).toMatchObject({
      messageId: "message-1",
      decision: "error",
      reason: "Candidate inspection failed",
    })
    expect(exception).toContain("raw Gmail diagnostic")
    expect(exception).toContain("socket closed unexpectedly")
  })

  it("drops a message Gmail no longer has, such as a draft that was sent", async () => {
    const { appendDecision, saveState, result } = await supervise({
      gmail: { getMessage: vi.fn().mockResolvedValue(null) },
      state: { ...emptyState, retryMessageIds: ["message-1"] },
    })

    expect(appendDecision).not.toHaveBeenCalled()
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
    expect(result).toMatchObject({ retried: 0, pending: 0 })
  })

  it("retries a failed message even when an earlier error is already logged", async () => {
    const { gmail, saveState } = await supervise({
      gmail: { listHistory: history() },
      state: { ...emptyState, retryMessageIds: ["message-1"] },
      log: [createLogEntry({ decision: "error" })],
    })

    expect(gmail.getMessage).toHaveBeenCalledWith("message-1")
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
  })

  it("does not let an error log suppress a retry when durable state was not saved", async () => {
    const { classify } = await supervise({
      gmail: { listHistory: history() },
      log: [createLogEntry({ decision: "error", classification: "processing-error" })],
    })

    expect(classify).toHaveBeenCalledTimes(1)
  })

  it("uses current Gmail labels for retries after failures that did not change Gmail", async () => {
    const promotionsMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PROMOTIONS"] })
    const { classify } = await supervise({
      gmail: {
        listHistory: history(),
        getMessage: vi.fn().mockResolvedValue(promotionsMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [promotionsMessage] }),
      },
      log: [
        createLogEntry({
          decision: "error",
          classification: "processing-error",
          originalLabels: ["INBOX", "CATEGORY_PERSONAL"],
        }),
      ],
    })

    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: expect.objectContaining({ category: "promotions" }) }),
    )
  })

  it("completes a retry without action after the message leaves Inbox", async () => {
    const archivedMessage = createMessage({ labelIds: ["IMPORTANT", "CATEGORY_UPDATES"] })
    const { classify, appendDecision, saveState, result } = await supervise({
      gmail: {
        listHistory: history(),
        getMessage: vi.fn().mockResolvedValue(archivedMessage),
      },
      state: { ...emptyState, retryMessageIds: ["message-1"] },
      log: [createLogEntry({ decision: "error", classification: "processing-error" })],
    })

    expect(classify).not.toHaveBeenCalled()
    expect(appendDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        originalLabels: ["IMPORTANT", "CATEGORY_UPDATES"],
        decision: "none",
        classification: "no-action",
        reason: "Message left Inbox before retry; no action taken.",
      }),
    )
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
    expect(result).toMatchObject({ unchanged: 1, retried: 0 })
  })

  it("does not retain an older thread retry after a newer message completes", async () => {
    const olderMessage = createMessage({ id: "message-1", threadId: "shared-thread" })
    const newerMessage = createMessage({ id: "message-2", threadId: "shared-thread" })
    const { classify, saveState } = await supervise({
      gmail: {
        listHistory: history(["message-2", "shared-thread"]),
        getMessage: vi.fn(async id => (id === "message-1" ? olderMessage : newerMessage)),
        getThread: vi.fn().mockResolvedValue({
          id: "shared-thread",
          messages: [olderMessage, newerMessage],
        }),
      },
      state: { ...emptyState, retryMessageIds: ["message-1"] },
      log: [
        createLogEntry({
          threadId: "shared-thread",
          decision: "error",
          classification: "processing-error",
        }),
      ],
    })

    expect(classify).toHaveBeenCalledTimes(1)
    expect(classify.mock.calls[0]?.[0].candidate.messageId).toBe("message-2")
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
  })

  it("finishes an idempotent promotion retry when labels changed before verification failed", async () => {
    const promotedMessage = createMessage({ labelIds: ["INBOX", "CATEGORY_PERSONAL"] })
    const { classify, gmail, saveState, result } = await supervise({
      classify: vi.fn().mockResolvedValue(keepJev),
      gmail: {
        listHistory: history(),
        getMessage: vi.fn().mockResolvedValue(promotedMessage),
        getThread: vi.fn().mockResolvedValue({ id: "thread-1", messages: [promotedMessage] }),
      },
      state: { ...emptyState, retryMessageIds: ["message-1"] },
      log: [
        createLogEntry({
          decision: "error",
          classification: "promote-error",
          originalLabels: ["INBOX", "CATEGORY_PROMOTIONS"],
        }),
      ],
    })

    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: expect.objectContaining({ category: "promotions" }) }),
    )
    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(saveState).toHaveBeenLastCalledWith(expect.objectContaining({ retryMessageIds: [] }))
    expect(result.promoted).toBe(1)
  })

  it("handles at most the action cap per run and leaves the rest pending", async () => {
    const messages = Array.from({ length: MAX_ACTIONS_PER_RUN + 3 }, (_, index) =>
      createMessage({ id: `message-${index}`, threadId: `thread-${index}` }),
    )
    const { classify, gmail, result } = await supervise({
      logOnly: true,
      classify: vi.fn().mockResolvedValue(archiveJev),
      gmail: {
        listHistory: history(...messages.map(message => [message.id, message.threadId] as const)),
        getMessage: vi.fn(async id => messages.find(item => item.id === id)!),
        getThread: vi.fn(async id => ({
          id,
          messages: [messages.find(item => item.threadId === id)!],
        })),
      },
    })

    expect(classify).toHaveBeenCalledTimes(MAX_ACTIONS_PER_RUN)
    expect(gmail.modifyThreadLabels).not.toHaveBeenCalled()
    expect(result).toMatchObject({ archived: MAX_ACTIONS_PER_RUN, retried: 0, pending: 3 })
  })
})

/** Run the supervisor against fakes, returning the fakes for assertions. */
async function supervise(
  /** Per-test overrides. */
  options: {
    gmail?: Partial<GmailClient>
    classify?: GmailSupervisorDependencies["classify"]
    state?: EmailProcessingState
    log?: DecisionLogEntry[]
    logOnly?: boolean
    saveState?: GmailSupervisorDependencies["saveState"]
    appendDecision?: GmailSupervisorDependencies["appendDecision"]
    queueUnsubscribe?: GmailSupervisorDependencies["queueUnsubscribe"]
  } = {},
) {
  const gmail = createGmailClient(options.gmail)
  const classify = vi.fn(options.classify ?? (async () => keepJev))
  const saveState = vi.fn(options.saveState ?? (async () => {}))
  const appendDecision = vi.fn(options.appendDecision ?? (async () => {}))
  const result = await runGmailSupervisor({
    now: () => new Date("2026-08-26T12:00:00.000Z"),
    gmail,
    classify,
    logOnly: options.logOnly ?? false,
    queueUnsubscribe: options.queueUnsubscribe ?? (async () => {}),
    loadState: async () => options.state ?? emptyState,
    saveState,
    loadDecisionLog: async () => [...(options.log ?? [])],
    appendDecision,
  })
  return { result, gmail, classify, saveState, appendDecision }
}

/** Create a fake Gmail boundary with safe defaults. */
function createGmailClient(
  /** Per-test Gmail behavior overrides. */
  overrides: Partial<GmailClient> = {},
): GmailClient {
  return {
    getProfile: vi.fn().mockResolvedValue({ historyId: "105" }),
    listHistory: history(["message-1", "thread-1"]),
    getMessage: vi.fn().mockResolvedValue(inboxMessage),
    getThread: vi.fn().mockResolvedValue(inboxThread),
    isThreadInInbox: vi.fn().mockResolvedValue(true),
    getAttachmentData: vi.fn().mockResolvedValue(""),
    getLabelIdByName: vi.fn().mockResolvedValue(null),
    hasPriorReplyTo: vi.fn().mockResolvedValue(false),
    modifyThreadLabels: vi.fn().mockResolvedValue(undefined),
    listFilters: vi.fn().mockResolvedValue([]),
    createArchiveFilter: vi.fn().mockResolvedValue("filter-1"),
    ...overrides,
  }
}

/** Fake history returning the given message and thread IDs as added messages. */
function history(
  /** Message and thread ID pairs. */
  ...references: (readonly [string, string])[]
) {
  return vi.fn().mockResolvedValue({
    addedMessages: references.map(([messageId, threadId]) => ({ messageId, threadId })),
    labelChanges: [],
  })
}

/** Create a Gmail message fixture with optional identity, labels and text. */
function createMessage(
  /** Fixture overrides. */
  overrides: {
    id?: string
    threadId?: string
    labelIds?: string[]
    subject?: string
    body?: string
    from?: string
    internalDate?: string
  },
): GmailMessage {
  return {
    ...inboxMessage,
    id: overrides.id ?? inboxMessage.id,
    threadId: overrides.threadId ?? inboxMessage.threadId,
    internalDate: overrides.internalDate ?? inboxMessage.internalDate,
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
      body: { data: encode(overrides.body ?? "Would you like to buy our software?") },
    },
  }
}

/** The default thread with every message given the labels. */
function threadWithLabels(
  /** Labels after the change. */
  labelIds: string[],
): GmailThread {
  return { ...inboxThread, messages: [{ ...inboxMessage, labelIds }] }
}

/** Create a prior decision fixture. */
function createLogEntry(
  /** Fixture overrides. */
  overrides: Partial<DecisionLogEntry> = {},
): DecisionLogEntry {
  return {
    policyVersion: "sha256:test-policy",
    timestamp: "2026-08-25T12:00:00.000Z",
    messageId: "message-1",
    threadId: "thread-1",
    sender: "Vendor Person <vendor@example.com>",
    subject: "A proposal",
    originalLabels: ["INBOX", "CATEGORY_PERSONAL"],
    decision: "none",
    classification: "keep",
    confidence: "low",
    reason: "Jev: keep (keep 0.6, transactional).",
    policySignals: ["transactional"],
    gmailUrl: "https://mail.google.com/mail/#all/thread-1",
    ...overrides,
  }
}

/** Encode text as Gmail base64url. */
function encode(
  /** Text. */
  text: string,
): string {
  return Buffer.from(text).toString("base64url")
}

const inboxMessage: GmailMessage = {
  id: "message-1",
  threadId: "thread-1",
  internalDate: "1787742000000",
  labelIds: ["INBOX", "CATEGORY_PERSONAL"],
  payload: {
    mimeType: "text/plain",
    headers: [
      { name: "From", value: "Vendor Person <vendor@example.com>" },
      { name: "To", value: "Herb Caudill <herb@devresults.com>" },
      { name: "Subject", value: "A proposal" },
    ],
    body: { data: encode("Would you like to buy our software?") },
  },
}

const oneClickMessage: GmailMessage = {
  ...inboxMessage,
  payload: {
    ...inboxMessage.payload,
    headers: [
      ...inboxMessage.payload!.headers!,
      {
        name: "List-Unsubscribe",
        value: "<mailto:u@example.com>, <https://unsubscribe.example.com/u/abc>",
      },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ],
  },
}

const inboxThread: GmailThread = { id: "thread-1", historyId: "101", messages: [inboxMessage] }

const uninitializedState: EmailProcessingState = {
  lastHistoryId: null,
  lastCompletedAt: null,
  retryMessageIds: [],
  archiveReversalSenders: [],
}

const emptyState: EmailProcessingState = { ...uninitializedState, lastHistoryId: "100" }
