import { describe, expect, it, vi } from "vitest"

import {
  createDelegatedGmailRequest,
  createGmailClient,
  GmailApiError,
  type GmailRequest,
} from "../createGmailClient.ts"
import { ExpiredGmailHistoryError } from "../supervisorTypes.ts"

describe("createGmailClient", () => {
  it("reads the profile, messages and threads and makes exact label changes", async () => {
    const responses: unknown[] = [
      { emailAddress: "herb@devresults.com", historyId: "105" },
      { id: "message-1", threadId: "thread-1", internalDate: "1787742000000", labelIds: ["INBOX"] },
      { id: "thread-1", messages: [] },
      {},
    ]
    const request = vi.fn<GmailRequest>(async () => responses.shift())
    const gmail = createGmailClient({ request })

    await expect(gmail.getProfile()).resolves.toEqual({ historyId: "105" })
    await expect(gmail.getMessage("message-1")).resolves.toMatchObject({ id: "message-1" })
    await expect(gmail.getThread("thread-1")).resolves.toEqual({ id: "thread-1", messages: [] })
    await gmail.modifyThreadLabels("thread-1", { addLabelIds: [], removeLabelIds: ["INBOX"] })

    expect(request.mock.calls.map(([call]) => call)).toEqual([
      { method: "GET", path: "profile" },
      { method: "GET", path: "messages/message-1", query: { format: "full" } },
      { method: "GET", path: "threads/thread-1", query: { format: "full" } },
      {
        method: "POST",
        path: "threads/thread-1/modify",
        body: { addLabelIds: [], removeLabelIds: ["INBOX"] },
      },
    ])
  })

  it("rejects a Gmail profile that does not match the fixed supervised account", async () => {
    const gmail = createGmailClient({
      request: async () => ({ emailAddress: "someone@example.com", historyId: "105" }),
    })

    await expect(gmail.getProfile()).rejects.toThrow("Unexpected Gmail account")
  })

  it("rejects message data without Gmail's trusted internal receipt time", async () => {
    const gmail = createGmailClient({
      request: async () => ({ id: "message-1", threadId: "thread-1" }),
    })

    await expect(gmail.getMessage("message-1")).rejects.toThrow("internalDate")
  })

  it("paginates history and preserves added messages and exact label transitions", async () => {
    const request = vi
      .fn<GmailRequest>()
      .mockResolvedValueOnce({
        history: [
          {
            messagesAdded: [{ message: { id: "message-1", threadId: "thread-1" } }],
            labelsRemoved: [{ message: { id: "message-2" }, labelIds: ["CATEGORY_PERSONAL"] }],
          },
        ],
        nextPageToken: "next-page",
      })
      .mockResolvedValueOnce({
        history: [
          { labelsAdded: [{ message: { id: "message-2" }, labelIds: ["CATEGORY_UPDATES"] }] },
        ],
      })
    const gmail = createGmailClient({ request })

    await expect(gmail.listHistory("100")).resolves.toEqual({
      addedMessages: [{ messageId: "message-1", threadId: "thread-1" }],
      labelChanges: [
        { messageId: "message-2", addedLabelIds: [], removedLabelIds: ["CATEGORY_PERSONAL"] },
        { messageId: "message-2", addedLabelIds: ["CATEGORY_UPDATES"], removedLabelIds: [] },
      ],
    })
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "GET",
      path: "history",
      query: { startHistoryId: "100", maxResults: 500, pageToken: "next-page" },
    })
  })

  it("returns null for a message Gmail no longer has", async () => {
    const gmail = createGmailClient({
      request: async () => {
        throw new GmailApiError("GET", "messages/gone", 404, "Requested entity was not found.")
      },
    })

    await expect(gmail.getMessage("gone")).resolves.toBeNull()
  })

  it("turns Gmail's 404 for an old history ID into the expired-history signal", async () => {
    const gmail = createGmailClient({
      request: async () => {
        throw new GmailApiError("GET", "history", 404, "Requested entity was not found.")
      },
    })

    await expect(gmail.listHistory("expired")).rejects.toBeInstanceOf(ExpiredGmailHistoryError)
  })

  it("checks prior replies against exact recipient addresses", async () => {
    const request = vi
      .fn<GmailRequest>()
      .mockResolvedValueOnce({ messages: [{ id: "sent-1" }] })
      .mockResolvedValueOnce({
        id: "sent-1",
        threadId: "sent-thread",
        internalDate: "1787742000000",
        payload: {
          headers: [
            { name: "From", value: "Herb Caudill <herb@devresults.com>" },
            { name: "To", value: "Person <person@example.com>" },
          ],
        },
      })
    const gmail = createGmailClient({ request })

    await expect(gmail.hasPriorReplyTo("person@example.com")).resolves.toBe(true)
    expect(request).toHaveBeenNthCalledWith(1, {
      method: "GET",
      path: "messages",
      query: { q: "in:sent to:(person@example.com)", maxResults: 10 },
    })
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "GET",
      path: "messages/sent-1",
      query: { format: "metadata", metadataHeaders: ["From", "To", "Cc", "Bcc"] },
    })
  })

  it("rejects a sender that could alter Gmail search syntax before calling Gmail", async () => {
    const request = vi.fn<GmailRequest>()
    const gmail = createGmailClient({ request })

    await expect(gmail.hasPriorReplyTo("person@example.com) OR from:anyone")).resolves.toBe(false)
    await expect(gmail.createArchiveFilter("a@example.com OR b@example.com")).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })

  it("rejects every label change except the two exact policy deltas", async () => {
    const request = vi.fn<GmailRequest>()
    const gmail = createGmailClient({ request })

    await expect(
      gmail.modifyThreadLabels("thread-1", { addLabelIds: ["STARRED"], removeLabelIds: [] }),
    ).rejects.toThrow("Unauthorized Gmail label mutation")
    expect(request).not.toHaveBeenCalled()
  })

  it("finds labels, reads attachments and checks where a thread is", async () => {
    const request = vi
      .fn<GmailRequest>()
      .mockResolvedValueOnce({
        labels: [
          { id: "INBOX", name: "INBOX" },
          { id: "Label_7", name: "Keep" },
        ],
      })
      .mockResolvedValueOnce({ data: "QkVHSU4" })
      .mockResolvedValueOnce({ messages: [{ labelIds: ["SENT"] }, { labelIds: ["INBOX"] }] })
      .mockRejectedValueOnce(new GmailApiError("GET", "threads/gone", 404, ""))
    const gmail = createGmailClient({ request })

    await expect(gmail.getLabelIdByName("Keep")).resolves.toBe("Label_7")
    await expect(gmail.getAttachmentData("message-1", "ics-1")).resolves.toBe("QkVHSU4")
    await expect(gmail.isThreadInInbox("thread-1")).resolves.toBe(true)
    await expect(gmail.isThreadInInbox("gone")).resolves.toBeNull()
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "GET",
      path: "messages/message-1/attachments/ics-1",
    })
  })

  it("lists filters and creates a filter that archives one sender", async () => {
    const request = vi
      .fn<GmailRequest>()
      .mockResolvedValueOnce({
        filter: [
          {
            id: "f1",
            criteria: { from: "news@example.com" },
            action: { removeLabelIds: ["INBOX"] },
          },
          { id: "f2", criteria: { subject: "invoice" }, action: { addLabelIds: ["Label_1"] } },
        ],
      })
      .mockResolvedValueOnce({ id: "f3" })
    const gmail = createGmailClient({ request })

    await expect(gmail.listFilters()).resolves.toEqual([
      { id: "f1", from: "news@example.com", removeLabelIds: ["INBOX"] },
      { id: "f2", from: "", removeLabelIds: [] },
    ])
    await expect(gmail.createArchiveFilter("promo@example.com")).resolves.toBe("f3")
    expect(request).toHaveBeenLastCalledWith({
      method: "POST",
      path: "settings/filters",
      body: { criteria: { from: "promo@example.com" }, action: { removeLabelIds: ["INBOX"] } },
    })
  })
})

describe("createDelegatedGmailRequest", () => {
  it("reuses one access token, repeats array parameters and retries rate limits", async () => {
    const getAccessToken = vi.fn().mockResolvedValue("token-1")
    const fetch = vi
      .fn<(url: URL, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response('{"error":{"errors":[{"reason":"rateLimitExceeded"}]}}', { status: 403 }),
      )
      .mockResolvedValueOnce(Response.json({ id: "m1" }))
      .mockResolvedValueOnce(Response.json({ id: "m2" }))
    const request = createDelegatedGmailRequest({ fetch, getAccessToken, sleep: async () => {} })

    await expect(
      request({
        method: "GET",
        path: "messages/m1",
        query: { format: "metadata", metadataHeaders: ["From", "To"] },
      }),
    ).resolves.toEqual({ id: "m1" })
    await request({ method: "GET", path: "messages/m2" })

    expect(getAccessToken).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]!
    expect(url.toString()).toBe(
      "https://gmail.googleapis.com/gmail/v1/users/herb%40devresults.com/messages/m1?format=metadata&metadataHeaders=From&metadataHeaders=To",
    )
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer token-1")
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it("throws a Gmail API error with the status for other failures", async () => {
    const request = createDelegatedGmailRequest({
      fetch: async () => new Response("not found", { status: 404 }),
      getAccessToken: async () => "token",
      sleep: async () => {},
    })

    const error = await request({ method: "GET", path: "history" }).catch(caught => caught)
    expect(error).toBeInstanceOf(GmailApiError)
    expect(error).toMatchObject({ status: 404, responseText: "not found" })
  })
})
