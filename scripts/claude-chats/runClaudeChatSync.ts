import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as sleep } from "node:timers/promises"

import { isMainModule } from "../isMainModule.ts"
import { findExportLink } from "./findExportLink.ts"
import { findSecrets } from "./findSecrets.ts"
import { planChatImport } from "./planChatImport.ts"
import type { Conversation, ExistingChat } from "./planChatImport.ts"

/** Request a Claude export, download its conversations, and commit changes to the notes vault. */
async function main() {
  const startedAt = Date.now()
  mkdirSync(CHATS_DIR, { recursive: true })

  requestExport()
  log("Export requested")

  const manifestLink = await waitForExportLink(startedAt)
  // Export links are single-use, so each one is opened exactly once and never retried.
  openInNewChromeTab(manifestLink)
  const manifestPath = await waitForDownload(/^manifest-.*\.json$/, startedAt)
  const conversationsLink = readConversationsLink(manifestPath)
  openInNewChromeTab(conversationsLink)
  const zipPath = await waitForDownload(/^conversations-\d+( \(\d+\))?\.zip$/, startedAt)
  log("Export downloaded")

  const withheld = importConversations(zipPath)

  rmSync(manifestPath)
  rmSync(zipPath)
  closeExportTabs()

  if (withheld.length) throw new Error(`Withheld ${withheld.length} chats: ${withheld.join("; ")}`)
}

/** Ask headless Codex to click Export data in the signed-in Chrome. */
function requestExport() {
  const prompt = readFileSync(join(SCRIPT_DIR, "requestExport.prompt.md"), "utf8")
  const result = spawnSync(
    "codex",
    [
      "-a",
      "never",
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "--color",
      "never",
      "-s",
      "read-only",
      "-",
    ],
    {
      cwd: tmpdirForCodex(),
      input: prompt,
      encoding: "utf8",
      timeout: CODEX_TIMEOUT_MS,
      maxBuffer: 16_000_000,
    },
  )
  const lastLine = result.stdout?.trim().split("\n").at(-1) ?? ""
  if (result.status !== 0 || lastLine !== "EXPORT_REQUESTED")
    throw new Error(`Codex did not request the export: ${lastLine || `exit ${result.status}`}`)
}

/** Give Codex an empty working directory so no repository instructions affect the run. */
function tmpdirForCodex(): string {
  const directory = join(homedir(), ".local/share/claude-chat-sync/codex")
  mkdirSync(directory, { recursive: true })
  return directory
}

/** Poll Gmail until the "ready" email for this run arrives. */
async function waitForExportLink(
  /** Run start, so older exports are ignored. */
  startedAt: number,
): Promise<string> {
  const after = Math.floor(startedAt / 1_000)
  const query = `subject:"Your data is ready for download" from:mail.anthropic.com after:${after}`
  const deadline = Date.now() + EMAIL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const { messages = [] } = gws(["messages", "list"], { userId: "me", q: query, maxResults: 1 })
    if (messages[0]) {
      const message = gws(["messages", "get"], { userId: "me", id: messages[0].id, format: "full" })
      const from = headerValue(message, "From")
      const link = findExportLink(
        from.match(/<(.+)>/)?.[1] ?? from.trim(),
        decodeBody(message.payload),
      )
      if (!link) throw new Error("The export email had no valid link")
      return link
    }
    await sleep(POLL_MS)
  }
  throw new Error("The export email did not arrive within an hour")
}

/** Run a Gmail read through the delegated CLI. */
function gws(
  /** Resource and method under gmail users. */
  method: string[],
  /** Request parameters. */
  params: Record<string, unknown>,
) {
  const args = ["gmail", "users", ...method, "--params", JSON.stringify(params)]
  return JSON.parse(
    execFileSync("gws-delegated", args, { encoding: "utf8", maxBuffer: 16_000_000 }),
  )
}

/** Read one header from a Gmail message. */
function headerValue(
  /** Gmail message. */
  message: { payload?: { headers?: { name: string; value: string }[] } },
  /** Header name. */
  name: string,
): string {
  return (
    message.payload?.headers?.find(header => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  )
}

/** Decode every text part of a Gmail message into one string. */
function decodeBody(
  /** Gmail message part. */
  part: GmailPart | undefined,
): string {
  if (!part) return ""
  const own = part.body?.data ? Buffer.from(part.body.data, "base64url").toString("utf8") : ""
  return [own, ...(part.parts ?? []).map(decodeBody)].join("\n")
}

/** Open a link in a new background Chrome tab; each tab gets its own automatic download. */
function openInNewChromeTab(
  /** Validated export link. */
  url: string,
) {
  execFileSync("open", ["-g", "-a", "Google Chrome", url])
}

/** Wait for Chrome to finish a download started during this run. */
async function waitForDownload(
  /** File-name pattern. */
  pattern: RegExp,
  /** Run start, so older files are ignored. */
  startedAt: number,
): Promise<string> {
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS
  while (Date.now() < deadline) {
    const paths = DOWNLOAD_DIRS.flatMap(directory =>
      readdirSync(directory).map(name => join(directory, name)),
    )
    const match = paths.find(
      path => pattern.test(basename(path)) && statSync(path).mtimeMs >= startedAt,
    )
    const inProgress = paths.some(path => path.endsWith(".crdownload"))
    if (match && !inProgress) return match
    await sleep(2_000)
  }
  throw new Error(`Timed out waiting for a download matching ${pattern}`)
}

/** Get the conversations link from a downloaded manifest. */
function readConversationsLink(
  /** Downloaded manifest path. */
  manifestPath: string,
): string {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest
  const files = manifest.data_files.filter(file => file.category === "conversations")
  // Large accounts could be split across parts, which this job doesn't handle yet.
  if (files.length !== 1) throw new Error(`Expected 1 conversations file, found ${files.length}`)
  const url = files[0].export_url
  if (!url.startsWith("https://claude.ai/export/")) throw new Error("Unexpected conversations link")
  return url
}

/** Apply an export to the vault and return descriptions of any chats held back for secrets. */
function importConversations(
  /** Downloaded conversations zip. */
  zipPath: string,
): string[] {
  const json = execFileSync("unzip", ["-p", zipPath, "conversations.json"], {
    maxBuffer: 2_000_000_000,
  })
  const conversations = JSON.parse(json.toString("utf8")) as Conversation[]
  const existing = readExistingChats()
  // A much smaller export means something is wrong upstream, not that chats were deleted.
  if (conversations.length < existing.length / 2)
    throw new Error(`Export has ${conversations.length} chats but the vault has ${existing.length}`)

  const { writes } = planChatImport(conversations, existing)
  const withheld: string[] = []
  const safeWrites = writes.filter(write => {
    const secrets = findSecrets(write.content)
    if (secrets.length) withheld.push(`${write.fileName} (${secrets.join(", ")})`)
    return !secrets.length
  })
  for (const { fileName, content } of safeWrites) writeFileSync(join(CHATS_DIR, fileName), content)
  log(`${safeWrites.length} chats changed, ${withheld.length} withheld`)
  if (safeWrites.length) commitChats(safeWrites.length)
  return withheld
}

/** Read the chats already in the vault, keyed by the ID in their frontmatter. */
function readExistingChats(): ExistingChat[] {
  return readdirSync(CHATS_DIR)
    .filter(fileName => fileName.endsWith(".md"))
    .flatMap(fileName => {
      const content = readFileSync(join(CHATS_DIR, fileName), "utf8")
      const uuid = content.match(/^claude_chat_uuid: (.+)$/m)?.[1]
      return uuid ? [{ uuid, fileName, content }] : []
    })
}

/** Commit only the chats folder, leaving any other vault changes for vault sync. */
function commitChats(
  /** Number of changed chats. */
  count: number,
) {
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", NOTES_DIR, ...args], { stdio: "inherit" })
  git("add", "chats")
  git("commit", "-q", "-m", `chats: sync ${count} Claude chats`, "--", "chats")
  git("pull", "-q", "--rebase", "--autostash")
  git("push", "-q")
}

/** Close the tabs left behind by export links. A failure here shouldn't fail the sync. */
function closeExportTabs() {
  const script = `tell application "Google Chrome"
    repeat with w in windows
      close (tabs of w whose URL contains "claude.ai/export/")
    end repeat
  end tell`
  const result = spawnSync("osascript", ["-e", script], { encoding: "utf8" })
  if (result.status !== 0) log("Could not close export tabs")
}

/** Log with a timestamp. */
function log(
  /** Message to log. */
  message: string,
) {
  console.log(`${new Date().toISOString()} ${message}`)
}

/** Show a macOS notification so a failed night isn't silent. */
function notifyFailure(
  /** Failure description. */
  message: string,
) {
  const script = `display notification ${JSON.stringify(message)} with title "Claude chat sync failed"`
  spawnSync("osascript", ["-e", script])
}

// CONSTANTS

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const NOTES_DIR = join(homedir(), "Code/HerbCaudill/notes")
const CHATS_DIR = join(NOTES_DIR, "chats")
// Chrome has saved exports to both of these on this machine.
const DOWNLOAD_DIRS = [join(homedir(), "Desktop"), join(homedir(), "Downloads")]
const CODEX_TIMEOUT_MS = 10 * 60_000
const EMAIL_TIMEOUT_MS = 60 * 60_000
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000
const POLL_MS = 30_000

// TYPES

/** A Gmail message part. */
type GmailPart = {
  /** Encoded body. */
  body?: {
    /** Base64url data. */
    data?: string
  }
  /** Nested parts. */
  parts?: GmailPart[]
}

/** The part of the export manifest this job reads. */
type Manifest = {
  /** Files in the export. */
  data_files: {
    /** Kind of data. */
    category: string
    /** Single-use download link. */
    export_url: string
  }[]
}

// Runs last so the constants above are initialized before main reads them.
if (isMainModule(import.meta.url)) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    log(`FAILED: ${message}`)
    notifyFailure(message)
    process.exit(1)
  })
}
