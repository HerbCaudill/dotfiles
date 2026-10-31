/** Work out which chat files a Claude export should create or change, keyed by chat ID. */
export function planChatImport(
  /** Conversations from the export's conversations.json. */
  conversations: readonly Conversation[],
  /** Chats already in the vault; ones missing from the export are left alone. */
  existing: readonly ExistingChat[],
): ChatImportPlan {
  const existingByUuid = new Map(existing.map(chat => [chat.uuid, chat]))
  const usedNames = new Set(existing.map(chat => chat.fileName))
  const writes: ChatWrite[] = []
  let skipped = 0

  for (const conversation of conversations) {
    const turns = (conversation.chat_messages ?? []).flatMap(renderTurn)
    if (!turns.length) {
      skipped++
      continue
    }
    const content = renderChat(conversation, turns)
    const current = existingByUuid.get(conversation.uuid)
    if (current?.content === content) continue
    // A renamed chat stays in its original file, so links and history keep working.
    const fileName = current?.fileName ?? chooseFileName(conversation, usedNames)
    usedNames.add(fileName)
    writes.push({ fileName, content })
  }

  return { writes, skipped }
}

/** Render one message as a Markdown section, or nothing if it has no content. */
function renderTurn(
  /** Message from the export. */
  message: Message,
): string[] {
  const parts = (message.content ?? []).flatMap(part => {
    if (part.type === "text" || part.type === "voice_note") return part.text ? [part.text] : []
    if (part.type === "image") return ["_[image]_"]
    return []
  })
  const body = parts.length ? parts.join("\n\n") : (message.text ?? "")
  const fileNames = [...(message.attachments ?? []), ...(message.files ?? [])]
    .map(file => file.file_name)
    .filter(Boolean)
  const files = fileNames.length ? `_Files: ${fileNames.join(", ")}_` : ""
  const text = [body.trim(), files].filter(Boolean).join("\n\n")
  if (!text) return []
  return [`## ${message.sender === "human" ? "Herb" : "Claude"}\n\n${text}`]
}

/** Render a whole chat with the frontmatter agents use to identify it. */
function renderChat(
  /** Conversation from the export. */
  conversation: Conversation,
  /** Rendered message sections. */
  turns: readonly string[],
): string {
  const title = conversation.name?.trim() || "Untitled chat"
  return [
    "---",
    "source: claude.ai",
    `claude_chat_uuid: ${conversation.uuid}`,
    `title: ${JSON.stringify(title)}`,
    `source_created_at: ${conversation.created_at}`,
    `source_updated_at: ${conversation.updated_at}`,
    "---",
    "",
    `# ${title}`,
    "",
    turns.join("\n\n"),
    "",
  ].join("\n")
}

/** Choose an unused dated file name for a new chat. */
function chooseFileName(
  /** Conversation from the export. */
  conversation: Conversation,
  /** File names already taken. */
  usedNames: ReadonlySet<string>,
): string {
  const date = conversation.created_at.slice(0, 10).replaceAll("-", "")
  const base = `${date}-${slugify(conversation.name ?? "") || "untitled"}`
  const fileName = `${base}.md`
  return usedNames.has(fileName) ? `${base}-${conversation.uuid.slice(0, 8)}.md` : fileName
}

/** Turn a chat title into a lowercase file-name slug. */
function slugify(
  /** Chat title. */
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

// TYPES

/** A typed piece of message content. */
type ContentPart = {
  /** Content kind, such as text, thinking or tool_use. */
  type: string
  /** Text, for kinds that have it. */
  text?: string
}

/** A file referenced by a message. */
type FileReference = {
  /** Original file name. */
  file_name?: string
}

/** One message in a conversation. */
type Message = {
  /** Either human or assistant. */
  sender: string
  /** Flattened text, used when content is empty. */
  text?: string
  /** Typed content parts. */
  content?: ContentPart[]
  /** Attached files. */
  attachments?: FileReference[]
  /** Uploaded files. */
  files?: FileReference[]
}

/** One conversation from conversations.json. */
export type Conversation = {
  /** Stable chat ID. */
  uuid: string
  /** Chat title. */
  name?: string
  /** ISO creation time. */
  created_at: string
  /** ISO last-update time. */
  updated_at: string
  /** Messages in order. */
  chat_messages?: Message[]
}

/** A chat file already in the vault. */
export type ExistingChat = {
  /** Chat ID from the file's frontmatter. */
  uuid: string
  /** File name within the chats folder. */
  fileName: string
  /** Current file content. */
  content: string
}

/** A file to create or replace. */
export type ChatWrite = {
  /** File name within the chats folder. */
  fileName: string
  /** New file content. */
  content: string
}

/** The result of comparing an export with the vault. */
export type ChatImportPlan = {
  /** Files to create or replace. */
  writes: ChatWrite[]
  /** Number of conversations with no content. */
  skipped: number
}
