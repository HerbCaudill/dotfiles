import { describe, expect, it } from "vitest"
import type {
  Session,
  SessionMessage,
} from "../../../home/.claude/skills/read-agent-sessions/scripts/types.ts"
import { planSessionNotes } from "../planSessionNotes.ts"

const now = new Date("2026-10-31T12:00:00.000Z")

/** Build a finished, human-driven session, with overrides for the case under test. */
function session(overrides: Partial<Session> = {}): Session {
  return {
    provider: "codex",
    machine: "mini",
    id: "abc-123",
    path: "C:/archive/machines/mini/codex/sessions/rollout.jsonl.gz",
    cwd: "C:\\Code\\HerbCaudill\\tasks",
    createdAt: "2026-10-20T08:00:00.000Z",
    fileModifiedAt: new Date("2026-10-20T09:00:00.000Z"),
    messages: conversation("Why does the sync stall?", "A lock was left behind."),
    ...overrides,
  }
}

/** Build a user question and an assistant reply. */
function conversation(user: string, assistant: string): SessionMessage[] {
  return [
    { role: "user", text: user },
    { role: "assistant", text: assistant },
  ]
}

describe("planSessionNotes", () => {
  it("renders a conversation with identifying frontmatter and named speakers", () => {
    const { writes } = planSessionNotes([session()], [], now)

    expect(writes).toEqual([
      {
        fileName: "20261020-why-does-the-sync-stall.md",
        content: [
          "---",
          "source: codex",
          "machine: mini",
          "session_id: abc-123",
          `title: "Why does the sync stall?"`,
          "project: HerbCaudill/tasks",
          `cwd: "C:\\\\Code\\\\HerbCaudill\\\\tasks"`,
          "source_created_at: 2026-10-20T08:00:00.000Z",
          "source_updated_at: 2026-10-20T09:00:00.000Z",
          "---",
          "",
          "# Why does the sync stall?",
          "",
          "## Herb",
          "",
          "Why does the sync stall?",
          "",
          "## Codex",
          "",
          "A lock was left behind.",
          "",
        ].join("\n"),
      },
    ])
  })

  it("leaves out tool traffic", () => {
    const messages: SessionMessage[] = [
      ...conversation("Check it", "Done."),
      { role: "tool", text: "secret-free but noisy output" },
    ]

    const { writes } = planSessionNotes([session({ messages })], [], now)

    expect(writes[0].content).not.toContain("noisy output")
  })

  it("removes injected context from user messages and keeps what Herb wrote", () => {
    const text = `see this thread\n\n<t3_context version="1">\ntitle: Parity\n</t3_context>\n<system-reminder>be good</system-reminder>`

    const { writes } = planSessionNotes(
      [session({ messages: conversation(text, "Sure.") })],
      [],
      now,
    )

    expect(writes[0].fileName).toBe("20261020-see-this-thread.md")
    expect(writes[0].content).toContain("## Herb\n\nsee this thread\n\n## Codex")
  })

  it("keeps pasted text and slash commands but drops their wrapper tags", () => {
    const pasted = `<pasted_content id="1">the heading is too small</pasted_content>`
    const command = `<command-message>t3feedback</command-message> <command-name>/t3feedback</command-name> <command-args>fix it</command-args>`

    const { writes } = planSessionNotes(
      [
        session({ id: "a", messages: conversation(pasted, "Agreed.") }),
        session({ id: "b", messages: conversation(command, "Filed.") }),
      ],
      [],
      now,
    )

    expect(writes[0].content).toContain("## Herb\n\nthe heading is too small\n\n")
    expect(writes[1].content).toContain("## Herb\n\n/t3feedback fix it\n\n")
  })

  it.each([
    ["subagent logs", { path: "C:/archive/claude/projects/x/abc/subagents/agent-1.jsonl.gz" }],
    ["sessions with no user message", { messages: [{ role: "assistant", text: "Hi" }] }],
    ["sessions with no reply", { messages: [{ role: "user", text: "Anyone there?" }] }],
    ["automated runs", { messages: conversation("Parity coordinator run. Read the plan.", "OK") }],
    ["delegated workers", { messages: conversation("Act as the review sub-agent.", "OK") }],
    [
      "sessions changed within the last day",
      { fileModifiedAt: new Date(now.getTime() - 3600_000) },
    ],
  ] as [string, Partial<Session>][])("skips %s", (_, overrides) => {
    const { writes } = planSessionNotes([session(overrides)], [], now)

    expect(writes).toEqual([])
  })

  it("does not rewrite an unchanged note", () => {
    const [{ fileName, content }] = planSessionNotes([session()], [], now).writes

    const { writes } = planSessionNotes(
      [session()],
      [{ machine: "mini", sessionId: "abc-123", fileName, content }],
      now,
    )

    expect(writes).toEqual([])
  })

  it("updates a changed session in its existing file", () => {
    const existing = {
      machine: "mini",
      sessionId: "abc-123",
      fileName: "20261020-original-name.md",
      content: "old",
    }

    const { writes } = planSessionNotes([session()], [existing], now)

    expect(writes.map(write => write.fileName)).toEqual(["20261020-original-name.md"])
  })

  it("treats the same ID on another machine as a separate note", () => {
    const existing = {
      machine: "macbook",
      sessionId: "abc-123",
      fileName: "20261020-why-does-the-sync-stall.md",
      content: "other machine",
    }

    const { writes } = planSessionNotes([session()], [existing], now)

    expect(writes.map(write => write.fileName)).toEqual([
      "20261020-why-does-the-sync-stall-abc-123.md",
    ])
  })

  it("gives every note its own file when titles and ID prefixes match", () => {
    // Codex IDs start with a timestamp, so sessions from the same minute share a prefix.
    const { writes } = planSessionNotes(
      [
        session({ id: "019fdbc1-aaaa" }),
        session({ id: "019fdbc1-bbbb" }),
        session({ id: "019fdbc1-cccc" }),
      ],
      [],
      now,
    )

    expect(new Set(writes.map(write => write.fileName)).size).toBe(3)
  })

  it("uses the newest log when one session has several", () => {
    const older = session({
      fileModifiedAt: new Date("2026-10-20T09:00:00.000Z"),
      messages: conversation("First question", "Older reply"),
    })
    const newer = session({
      fileModifiedAt: new Date("2026-10-21T09:00:00.000Z"),
      messages: conversation("First question", "Newer reply"),
    })

    const { writes } = planSessionNotes([older, newer], [], now)

    expect(writes).toHaveLength(1)
    expect(writes[0].content).toContain("Newer reply")
  })

  it("keeps the fullest note when forks repeat a long prompt on the same day", () => {
    const text = "another agent has provided a design. do we need new tasks?"
    const fork = (id: string, timestamp: string, replies: string[]) =>
      session({
        id,
        messages: [
          { role: "user", text, timestamp },
          ...replies.map(reply => ({ role: "assistant" as const, text: reply })),
          { role: "user", text: "next", timestamp },
        ],
      })

    const { writes } = planSessionNotes(
      [
        fork("parent", "2026-07-28T18:44:00.000Z", ["one", "two", "three"]),
        fork("fork", "2026-07-28T18:48:00.000Z", ["one"]),
      ],
      [],
      now,
    )

    expect(writes).toHaveLength(1)
    expect(writes[0].content).toContain("session_id: parent")
  })

  it("keeps one note when two logs of a session open differently", () => {
    const log = (text: string, reply: string[]) =>
      session({
        messages: [
          { role: "user", text, timestamp: "2026-07-28T08:00:00.000Z" },
          ...reply.map(item => ({ role: "assistant" as const, text: item })),
        ],
      })

    const { writes } = planSessionNotes(
      [log("first opening", ["short"]), log("second opening", ["longer", "log"])],
      [],
      now,
    )

    expect(writes).toHaveLength(1)
    expect(writes[0].content).toContain("second opening")
  })

  it("keeps a short prompt repeated in separate conversations", () => {
    const repeat = (id: string, timestamp: string) =>
      session({
        id,
        messages: [
          { role: "user", text: "sure", timestamp },
          { role: "assistant", text: `Reply for ${id}` },
        ],
      })

    const { writes } = planSessionNotes(
      [repeat("a", "2026-07-28T08:00:00.000Z"), repeat("b", "2026-07-28T17:00:00.000Z")],
      [],
      now,
    )

    expect(writes).toHaveLength(2)
  })

  it("drops harness notifications delivered as user messages", () => {
    const messages: SessionMessage[] = [
      { role: "user", text: "Run the tests" },
      { role: "assistant", text: "Started." },
      { role: "user", text: "<task-notification><summary>Done</summary></task-notification>" },
      { role: "assistant", text: "They passed." },
    ]

    const { writes } = planSessionNotes([session({ messages })], [], now)

    expect(writes[0].content).not.toContain("task-notification")
    expect(writes[0].content).toContain("## Codex\n\nStarted.\n\nThey passed.\n")
  })

  it("removes automation heartbeats from agent replies", () => {
    const reply = "Still running.\n\n<heartbeat>\n  <decision>DONT_NOTIFY</decision>\n</heartbeat>"

    const { writes } = planSessionNotes(
      [session({ messages: conversation("Watch the build", reply) })],
      [],
      now,
    )

    expect(writes[0].content).toContain("## Codex\n\nStill running.\n")
    expect(writes[0].content).not.toContain("DONT_NOTIFY")
  })

  it("withholds a session containing a secret and names only the kind", () => {
    const key = `sk-ant-${"a".repeat(30)}`
    const { writes, withheld } = planSessionNotes(
      [session({ messages: conversation(`use ${key}`, "OK") })],
      [],
      now,
    )

    expect(writes).toEqual([])
    expect(withheld).toEqual([{ machine: "mini", sessionId: "abc-123", kinds: ["Anthropic key"] }])
  })

  it("keeps one note when a resumed session copied an earlier conversation", () => {
    const timestamp = "2026-10-20T08:00:00.000Z"
    const first: SessionMessage = { role: "user", text: "Plan the move", timestamp }
    const reply: SessionMessage = { role: "assistant", text: "Original reply" }
    const original = session({
      id: "original",
      fileModifiedAt: new Date("2026-10-20T09:00:00.000Z"),
      messages: [first, reply],
    })
    const resumed = session({
      id: "resumed",
      fileModifiedAt: new Date("2026-10-22T09:00:00.000Z"),
      messages: [first, reply, { role: "assistant", text: "Later reply" }],
    })

    const { writes } = planSessionNotes([original, resumed], [], now)

    expect(writes).toHaveLength(1)
    expect(writes[0].content).toContain("session_id: resumed")
    expect(writes[0].content).toContain("Later reply")
  })
})
