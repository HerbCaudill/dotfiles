import { findSecrets } from "../claude-chats/findSecrets.ts"
import type {
  Session,
  SessionMessage,
} from "../../home/.claude/skills/read-agent-sessions/scripts/types.ts"

/** Work out which notes should be created or changed for the sessions Herb actually drove. */
export function planSessionNotes(
  /** Normalized sessions from the archive. */
  sessions: readonly Session[],
  /** Notes already in the vault; sessions missing from the archive are left alone. */
  existing: readonly ExistingNote[],
  /** Current time, used to leave active sessions until they go quiet. */
  now: Date,
): SessionNotePlan {
  const existingByKey = new Map(existing.map(note => [noteKey(note.machine, note.sessionId), note]))
  const usedNames = new Set(existing.map(note => note.fileName))
  const candidates = sessions.flatMap(session => toCandidate(session, now))
  const writes: SessionNoteWrite[] = []
  const withheld: WithheldSession[] = []

  // Each session owns one note, so logs sharing an ID must not overwrite each other.
  const unique = keepFullest(keepFullest(candidates, conversationKey), ({ session }) =>
    noteKey(session.machine ?? "local", session.id),
  )

  for (const candidate of unique) {
    const { session } = candidate
    const machine = session.machine ?? "local"
    const current = existingByKey.get(noteKey(machine, session.id))
    const content = renderNote(candidate)
    if (current?.content === content) continue

    const kinds = findSecrets(content)
    if (kinds.length) {
      // The title comes from the prompt, so a file name here could repeat the secret.
      withheld.push({ machine, sessionId: session.id, kinds })
      continue
    }

    // A note keeps its original file, so links and sync history keep working.
    const fileName = current?.fileName ?? chooseFileName(candidate, usedNames)
    usedNames.add(fileName)
    writes.push({ fileName, content })
  }

  return { writes, withheld }
}

/** Clean a session and keep it only if it is a finished conversation with Herb. */
function toCandidate(
  /** Normalized session. */
  session: Session,
  /** Current time. */
  now: Date,
): Candidate[] {
  if (SUBAGENT_PATH.test(session.path)) return []
  if (now.getTime() - session.fileModifiedAt.getTime() < QUIET_MS) return []

  const messages = session.messages.flatMap(cleanMessage)
  const firstUser = messages.find(message => message.role === "user")
  if (!firstUser || !messages.some(message => message.role === "assistant")) return []
  if (AUTOMATED_PROMPTS.some(prefix => firstUser.text.startsWith(prefix))) return []

  return [{ session, messages, title: toTitle(firstUser.text) }]
}

/** Keep conversation text, leaving out tool traffic and text the harness added. */
function cleanMessage(
  /** Normalized message. */
  message: SessionMessage,
): SessionMessage[] {
  if (message.role === "tool") return []
  const text =
    message.role === "user"
      ? cleanUserText(message.text)
      : message.text.replace(HEARTBEAT, "").trim()
  return text ? [{ ...message, text }] : []
}

/** Remove harness-injected blocks from a user message and unwrap what Herb supplied. */
function cleanUserText(
  /** Raw user message. */
  text: string,
): string {
  const withoutInjected = INJECTED_TAGS.reduce(
    (result, tag) => result.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "g"), ""),
    text,
  )
  const unwrapped = UNWRAPPED_TAGS.reduce(
    (result, tag) => result.replace(new RegExp(`</?${tag}\\b[^>]*>`, "g"), ""),
    withoutInjected,
  )
  return unwrapped
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Keep the fullest candidate for each key, preferring the newest when they are equally long. */
function keepFullest(
  /** Candidates in any order. */
  candidates: readonly Candidate[],
  /** Gets the key that candidates must not share. */
  getKey: (candidate: Candidate) => string,
): Candidate[] {
  const fullest = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const key = getKey(candidate)
    const current = fullest.get(key)
    if (!current || isFuller(candidate, current)) fullest.set(key, candidate)
  }
  return [...fullest.values()]
}

/** Check whether one log of a conversation should replace another. */
function isFuller(
  /** Log being considered. */
  candidate: Candidate,
  /** Log currently kept. */
  current: Candidate,
): boolean {
  if (candidate.messages.length !== current.messages.length)
    return candidate.messages.length > current.messages.length
  return candidate.session.fileModifiedAt > current.session.fileModifiedAt
}

/**
 * Identify a conversation across logs. A resumed Claude session copies earlier messages with their
 * timestamps. A Codex fork copies the prompt with a new timestamp, so a long prompt repeated on one
 * day counts as one conversation. Short prompts like "sure" genuinely recur, so they need an exact
 * timestamp match.
 */
function conversationKey(
  /** Cleaned session. */
  {
    session,
    messages,
  }: Candidate,
): string {
  const first = messages.find(message => message.role === "user")
  if (!first?.timestamp) return noteKey(session.machine ?? "local", session.id)
  const when =
    first.text.length >= LONG_PROMPT_LENGTH ? first.timestamp.slice(0, 10) : first.timestamp
  return noteKey(session.machine ?? "local", `${when}\n${first.text}`)
}

/** Key a note by machine as well as ID, because IDs can appear on several machines. */
function noteKey(
  /** Machine that produced the session. */
  machine: string,
  /** Session identity. */
  id: string,
): string {
  return `${machine}\n${id}`
}

/** Render a session with the frontmatter needed to trace it back to its full log. */
function renderNote(
  /** Cleaned session. */
  {
    session,
    messages,
    title,
  }: Candidate,
): string {
  const agent = session.provider === "claude" ? "Claude" : "Codex"
  const frontmatter = [
    "---",
    `source: ${session.provider}`,
    `machine: ${session.machine ?? "local"}`,
    `session_id: ${session.id}`,
    `title: ${JSON.stringify(title)}`,
    ...(toProject(session.cwd) ? [`project: ${toProject(session.cwd)}`] : []),
    ...(session.cwd ? [`cwd: ${JSON.stringify(session.cwd)}`] : []),
    `source_created_at: ${startedAt(session)}`,
    `source_updated_at: ${session.fileModifiedAt.toISOString()}`,
    "---",
  ]
  const turns = mergeTurns(messages).map(
    message => `## ${message.role === "user" ? "Herb" : agent}\n\n${message.text}`,
  )
  return [...frontmatter, "", `# ${title}`, "", turns.join("\n\n"), ""].join("\n")
}

/** Join consecutive messages from one speaker, so a turn gets a single heading. */
function mergeTurns(
  /** Cleaned messages. */
  messages: readonly SessionMessage[],
): SessionMessage[] {
  return messages.reduce<SessionMessage[]>((turns, message) => {
    const previous = turns.at(-1)
    if (previous?.role !== message.role) return [...turns, message]
    return [...turns.slice(0, -1), { ...previous, text: `${previous.text}\n\n${message.text}` }]
  }, [])
}

/** Get the session's start time, falling back to its last change for logs that lack one. */
function startedAt(
  /** Normalized session. */
  session: Session,
): string {
  return session.createdAt ?? session.fileModifiedAt.toISOString()
}

/** Turn a working directory into ORG/REPO when it is a checkout beneath a Code directory. */
function toProject(
  /** Recorded working directory. */
  cwd: string | undefined,
): string | undefined {
  const match = cwd?.match(/[\\/]code[\\/]([^\\/]+)[\\/]([^\\/]+)/i)
  return match ? `${match[1]}/${match[2]}` : undefined
}

/** Derive a one-line title from the first user message. */
function toTitle(
  /** Cleaned first user message. */
  text: string,
): string {
  const line = text.replace(/\s+/g, " ").trim()
  return line.length > 100 ? `${line.slice(0, 97)}...` : line
}

/** Choose an unused dated file name for a new note. */
function chooseFileName(
  /** Cleaned session. */
  { session, title }: Candidate,
  /** File names already taken. */
  usedNames: ReadonlySet<string>,
): string {
  const date = startedAt(session).slice(0, 10).replaceAll("-", "")
  const base = `${date}-${slugify(title) || "untitled"}`
  // Codex IDs start with a timestamp, and IDs can repeat across machines, so use all of it.
  const options = [base, `${base}-${session.id}`, `${base}-${session.machine}-${session.id}`]
  const available = options.map(name => `${name}.md`).find(name => !usedNames.has(name))
  if (!available) throw new Error(`No unused file name for session ${session.id}`)
  return available
}

/** Turn a title into a lowercase file-name slug. */
function slugify(
  /** Note title. */
  title: string,
): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
}

// CONSTANTS

const QUIET_MS = 24 * 3600_000
const SUBAGENT_PATH = /[\\/]subagents[\\/]/
const LONG_PROMPT_LENGTH = 40
const HEARTBEAT = /<heartbeat>[\s\S]*?<\/heartbeat>/g
const INJECTED_TAGS = [
  "citation_entries",
  "codex_delegation",
  "codex_internal_context",
  "command-message",
  "environment_context",
  "heartbeat",
  "in-app-browser-context",
  "local-command-caveat",
  "local-command-stderr",
  "local-command-stdout",
  "oai-mem-citation",
  "subagent_notification",
  "system-reminder",
  "t3_context",
  "task-notification",
]
const UNWRAPPED_TAGS = ["pasted_content", "command-name", "command-args"]

// The archive doesn't record how a session was started, so its opening prompt is the only signal.
const AUTOMATED_PROMPTS = [
  "# Present the ",
  "# Ralph session protocol",
  "<codex_delegation",
  "<codex_internal_context",
  "<external_codex_apps",
  "Act as the ",
  "Author `/",
  "Complete the following task.",
  "Context handoff",
  "Execute one reserved",
  "In /Users/herbcaudill/",
  "Parity ",
  "Present the ",
  "Reply exactly",
  "Review `/",
  "Run from /Users/herbcaudill/",
  "Run in /Users/herbcaudill/",
  "Run my morning briefing",
  "Run the $dream skill.",
  "The following is the Codex agent history",
  "Use only ToolSearch",
  "Use the parity-pipeline",
]

// TYPES

/** A session cleaned and accepted for export. */
type Candidate = {
  /** Source session. */
  session: Session
  /** Conversation with tool traffic and injected text removed. */
  messages: SessionMessage[]
  /** One-line title. */
  title: string
}

/** A session note already in the vault. */
export type ExistingNote = {
  /** Machine from the note's frontmatter. */
  machine: string
  /** Session ID from the note's frontmatter. */
  sessionId: string
  /** File name within the sessions folder. */
  fileName: string
  /** Current file content. */
  content: string
}

/** A note to create or replace. */
export type SessionNoteWrite = {
  /** File name within the sessions folder. */
  fileName: string
  /** New file content. */
  content: string
}

/** A session held back because it appears to contain a secret. */
export type WithheldSession = {
  /** Machine that produced the session. */
  machine: string
  /** Session ID. */
  sessionId: string
  /** Kinds of secret found, never the values. */
  kinds: string[]
}

/** The result of comparing the archive with the vault. */
export type SessionNotePlan = {
  /** Files to create or replace. */
  writes: SessionNoteWrite[]
  /** Sessions held back for secrets. */
  withheld: WithheldSession[]
}
