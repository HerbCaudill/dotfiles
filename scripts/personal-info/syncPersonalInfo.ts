import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** The repo-local plaintext file used by the personal-info skill. */
export const DEFAULT_PERSONAL_INFO_FILE = fileURLToPath(
  new URL("../../home/.claude/skills/personal-info/personal-info.md", import.meta.url),
)

/** The default 1Password vault containing the Secure Note. */
const DEFAULT_VAULT = "Private"

/** The default title of the 1Password Secure Note. */
const DEFAULT_ITEM = "Personal info"

/** A function that invokes the 1Password CLI without logging its input or output. */
type RunOp = (args: string[], input?: string) => string

/** Runtime configuration for a personal-info sync. */
type PersonalInfoSyncOptions = {
  /** The local plaintext destination or source. */
  filePath?: string
  /** The Secure Note title or ID. */
  item?: string
  /** The vault containing the Secure Note. */
  vault?: string
  /** An injectable 1Password CLI runner. */
  runOp?: RunOp
}

/** The subset of a 1Password item used during synchronization. */
type OnePasswordItem = Record<string, unknown> & {
  /** The stable item ID. */
  id: string
  /** The item's built-in and custom fields. */
  fields: Array<Record<string, unknown>>
}

/** Synchronize personal information with its 1Password Secure Note. */
export const syncPersonalInfo = (
  /** The direction to copy. */
  direction: "pull" | "push",
  /** Runtime dependencies and configuration. */
  options: PersonalInfoSyncOptions = {},
) => {
  const filePath = resolve(options.filePath ?? DEFAULT_PERSONAL_INFO_FILE)
  const item = options.item ?? process.env.PERSONAL_INFO_OP_ITEM ?? DEFAULT_ITEM
  const vault = options.vault ?? process.env.PERSONAL_INFO_OP_VAULT ?? DEFAULT_VAULT
  const runOp = options.runOp ?? runOnePasswordCommand
  const remoteItem = getSecureNote(runOp, item, vault)

  if (direction === "pull") {
    writePrivateFile(filePath, getNotes(remoteItem))
    return
  }

  chmodSync(filePath, 0o600)
  const localContents = readFileSync(filePath, "utf8")
  const updatedItem = setNotes(remoteItem, localContents)
  runOp(["item", "edit", remoteItem.id, "--vault", vault], JSON.stringify(updatedItem))
}

/** Retrieve a Secure Note without writing its contents to the terminal. */
const getSecureNote = (runOp: RunOp, item: string, vault: string) => {
  const rawItem = runOp(["item", "get", item, "--vault", vault, "--format", "json", "--reveal"])

  return parseItem(rawItem)
}

/** Parse and validate the fields needed from a 1Password item. */
const parseItem = (rawItem: string): OnePasswordItem => {
  const item: unknown = JSON.parse(rawItem)

  if (!isRecord(item) || typeof item.id !== "string" || !Array.isArray(item.fields)) {
    throw new Error("1Password returned an unexpected item shape")
  }

  if (!item.fields.every(isRecord)) {
    throw new Error("1Password returned an unexpected field shape")
  }

  return item as OnePasswordItem
}

/** Read the built-in notes field from a Secure Note. */
const getNotes = (item: OnePasswordItem) => {
  const notes = item.fields.find(field => field.id === "notesPlain")

  if (!notes || typeof notes.value !== "string") {
    throw new Error("The 1Password item is not a Secure Note with a notes field")
  }

  return notes.value
}

/** Return an item with an updated built-in notes field. */
const setNotes = (item: OnePasswordItem, value: string): OnePasswordItem => {
  if (!item.fields.some(field => field.id === "notesPlain")) {
    throw new Error("The 1Password item is not a Secure Note with a notes field")
  }

  return {
    ...item,
    fields: item.fields.map(field => (field.id === "notesPlain" ? { ...field, value } : field)),
  }
}

/** Atomically replace a local file and restrict it to the current user. */
const writePrivateFile = (filePath: string, contents: string) => {
  const directory = dirname(filePath)
  const temporaryFile = `${filePath}.${randomUUID()}.tmp`
  mkdirSync(directory, { recursive: true })

  try {
    writeFileSync(temporaryFile, contents, { flag: "wx", mode: 0o600 })
    renameSync(temporaryFile, filePath)
    chmodSync(filePath, 0o600)
  } finally {
    rmSync(temporaryFile, { force: true })
  }
}

/** Run the 1Password CLI with captured output and optional stdin. */
const runOnePasswordCommand: RunOp = (args, input) => {
  const result = spawnSync("op", args, {
    encoding: "utf8",
    input,
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.status === 0) return result.stdout

  throw new Error(
    "The 1Password command failed. Confirm that the CLI is installed, the app is unlocked, and the configured Secure Note exists.",
  )
}

/** Check whether a value is a non-null object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null
