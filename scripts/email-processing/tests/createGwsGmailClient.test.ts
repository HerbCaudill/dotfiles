import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

import { createGwsGmailClient } from "../createGwsGmailClient.ts"
import { ExpiredGmailHistoryError } from "../supervisorTypes.ts"

describe("createGwsGmailClient", () => {
  it("uses the delegated GWS command for unattended authentication", async () => {
    const executableDirectory = mkdtempSync(join(tmpdir(), "delegated-gws-test-"))
    const executablePath = join(executableDirectory, "gws-delegated")
    const previousPath = process.env.PATH
    writeFileSync(
      executablePath,
      '#!/bin/sh\nprintf \'%s\' \'{"emailAddress":"herb@devresults.com","historyId":"105"}\'\n',
    )
    chmodSync(executablePath, 0o755)
    process.env.PATH = executableDirectory

    try {
      await expect(createGwsGmailClient().getProfile()).resolves.toEqual({ historyId: "105" })
    } finally {
      process.env.PATH = previousPath
      rmSync(executableDirectory, { recursive: true, force: true })
    }
  })

  it("uses fixed argument-array commands for profile, discovery, context, and exact mutations", async () => {
    const responses = [
      { emailAddress: "herb@devresults.com", historyId: "105" },
      { messages: [{ id: "message-1", threadId: "thread-1" }] },
      {
        id: "message-1",
        threadId: "thread-1",
        internalDate: "1787742000000",
        labelIds: ["INBOX"],
      },
      { id: "thread-1", messages: [] },
      {},
    ]
    const run = vi.fn().mockImplementation(async () => JSON.stringify(responses.shift()))
    const gmail = createGwsGmailClient({ run })

    await expect(gmail.getProfile()).resolves.toEqual({ historyId: "105" })
    await expect(
      gmail.listRecentInboxMessages(new Date("2026-08-19T12:00:00.000Z")),
    ).resolves.toEqual([{ messageId: "message-1", threadId: "thread-1" }])
    await expect(gmail.getMessage("message-1")).resolves.toEqual({
      id: "message-1",
      threadId: "thread-1",
      internalDate: "1787742000000",
      labelIds: ["INBOX"],
    })
    await expect(gmail.getThread("thread-1")).resolves.toEqual({
      id: "thread-1",
      messages: [],
    })
    await gmail.modifyThreadLabels("thread-1", {
      addLabelIds: [],
      removeLabelIds: ["INBOX"],
    })

    expect(run.mock.calls).toEqual([
      [["gmail", "users", "getProfile", "--params", '{"userId":"herb@devresults.com"}']],
      [
        [
          "gmail",
          "users",
          "messages",
          "list",
          "--params",
          '{"userId":"herb@devresults.com","q":"in:inbox after:1787140800 -in:spam -in:trash","maxResults":500}',
        ],
      ],
      [
        [
          "gmail",
          "users",
          "messages",
          "get",
          "--params",
          '{"userId":"herb@devresults.com","id":"message-1","format":"full"}',
        ],
      ],
      [
        [
          "gmail",
          "users",
          "threads",
          "get",
          "--params",
          '{"userId":"herb@devresults.com","id":"thread-1","format":"full"}',
        ],
      ],
      [
        [
          "gmail",
          "users",
          "threads",
          "modify",
          "--params",
          '{"userId":"herb@devresults.com","id":"thread-1"}',
          "--json",
          '{"addLabelIds":[],"removeLabelIds":["INBOX"]}',
        ],
      ],
    ])
  })

  it("rejects a Gmail profile that does not match the fixed supervised account", async () => {
    const gmail = createGwsGmailClient({
      run: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({ emailAddress: "someone@example.com", historyId: "105" }),
        ),
    })

    await expect(gmail.getProfile()).rejects.toThrow("Unexpected Gmail account")
  })

  it("rejects message data without Gmail's trusted internal receipt time", async () => {
    const gmail = createGwsGmailClient({
      run: vi.fn().mockResolvedValue(JSON.stringify({ id: "message-1", threadId: "thread-1" })),
    })

    await expect(gmail.getMessage("message-1")).rejects.toThrow("internalDate")
  })

  it("paginates history and preserves added messages and exact label transitions", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          history: [
            {
              messagesAdded: [{ message: { id: "message-1", threadId: "thread-1" } }],
              labelsRemoved: [
                {
                  message: { id: "message-2", threadId: "thread-2" },
                  labelIds: ["CATEGORY_PERSONAL"],
                },
              ],
            },
          ],
          nextPageToken: "next-page",
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          history: [
            {
              labelsAdded: [
                {
                  message: { id: "message-2", threadId: "thread-2" },
                  labelIds: ["CATEGORY_UPDATES"],
                },
              ],
            },
          ],
        }),
      )
    const gmail = createGwsGmailClient({ run })

    await expect(gmail.listHistory("100")).resolves.toEqual({
      addedMessages: [{ messageId: "message-1", threadId: "thread-1" }],
      labelChanges: [
        {
          messageId: "message-2",
          addedLabelIds: [],
          removedLabelIds: ["CATEGORY_PERSONAL"],
        },
        {
          messageId: "message-2",
          addedLabelIds: ["CATEGORY_UPDATES"],
          removedLabelIds: [],
        },
      ],
    })
    expect(run).toHaveBeenNthCalledWith(2, [
      "gmail",
      "users",
      "history",
      "list",
      "--params",
      '{"userId":"herb@devresults.com","startHistoryId":"100","maxResults":500,"pageToken":"next-page"}',
    ])
  })

  it("converts an expired Gmail history response to the explicit fallback signal", async () => {
    const gmail = createGwsGmailClient({
      run: vi.fn().mockRejectedValue(new Error("404 Requested entity was not found: historyId")),
    })

    await expect(gmail.listHistory("expired")).rejects.toBeInstanceOf(ExpiredGmailHistoryError)
  })

  it("checks prior replies against exact recipient addresses without shell interpolation", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ messages: [{ id: "sent-1" }] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          id: "sent-1",
          threadId: "sent-thread",
          internalDate: "1787742000000",
          payload: {
            headers: [
              { name: "From", value: "Herb Caudill <herb@devresults.com>" },
              { name: "To", value: "Person <person@example.com>" },
            ],
          },
        }),
      )
    const gmail = createGwsGmailClient({ run })

    await expect(gmail.hasPriorReplyTo("person@example.com")).resolves.toBe(true)
    expect(run).toHaveBeenNthCalledWith(1, [
      "gmail",
      "users",
      "messages",
      "list",
      "--params",
      '{"userId":"herb@devresults.com","q":"in:sent to:(person@example.com)","maxResults":10}',
    ])
    expect(run).toHaveBeenNthCalledWith(2, [
      "gmail",
      "users",
      "messages",
      "get",
      "--params",
      '{"userId":"herb@devresults.com","id":"sent-1","format":"metadata","metadataHeaders":["From","To","Cc","Bcc"]}',
    ])
  })

  it("rejects a sender that could alter Gmail search syntax before invoking gws", async () => {
    const run = vi.fn()
    const gmail = createGwsGmailClient({ run })

    await expect(gmail.hasPriorReplyTo("person@example.com) OR from:anyone")).resolves.toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it("rejects every mutation except the two exact policy deltas", async () => {
    const run = vi.fn()
    const gmail = createGwsGmailClient({ run })

    await expect(
      gmail.modifyThreadLabels("thread-1", {
        addLabelIds: ["STARRED"],
        removeLabelIds: [],
      }),
    ).rejects.toThrow("Unauthorized Gmail label mutation")
    expect(run).not.toHaveBeenCalled()
  })
})
