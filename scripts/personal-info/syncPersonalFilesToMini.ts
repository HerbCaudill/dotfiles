import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"

import { DEFAULT_PERSONAL_INFO_FILE } from "./syncPersonalInfo.ts"

/** Mirror the Mac's two private files to the mini over SSH and verify delivery. */
export const syncPersonalFilesToMini = (
  /** Source files and transport overrides. */
  options: SyncOptions = {},
): string[] => {
  const directory = options.directory ?? dirname(DEFAULT_PERSONAL_INFO_FILE)
  const files = FILE_NAMES.map(name => {
    const path = join(directory, name)
    if ((statSync(path).mode & 0o777) !== 0o600) chmodSync(path, 0o600)
    const contents = readFileSync(path)
    if (!contents.length) throw new Error(`Refusing to sync an empty ${name}`)
    if (name.endsWith(".json")) validatePasswordJson(contents.toString("utf8"))
    return { name, contents: contents.toString("base64"), sha256: sha256(contents) }
  })
  const receiver = readFileSync(new URL("./receivePersonalFiles.ps1", import.meta.url), "utf8")
  const encodedCommand = Buffer.from(receiver, "utf16le").toString("base64")
  const output = (options.runSSH ?? runSSH)(
    [
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      "-o",
      "ServerAliveInterval=5",
      "-o",
      "ServerAliveCountMax=2",
      "mini",
      "pwsh",
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodedCommand,
    ],
    JSON.stringify({ files }),
  )

  let response: unknown
  try {
    response = JSON.parse(output)
  } catch {
    throw new Error("Mini returned an invalid sync receipt")
  }
  const receipts = isRecord(response) && Array.isArray(response.files) ? response.files : []
  if (
    receipts.length !== files.length ||
    !files.every(file =>
      receipts.some(
        receipt =>
          isRecord(receipt) &&
          receipt.name === file.name &&
          receipt.sha256 === file.sha256 &&
          typeof receipt.changed === "boolean",
      ),
    )
  )
    throw new Error("Mini did not verify both private files")

  return receipts.filter(receipt => receipt.changed).map(receipt => receipt.name as string)
}

/** Reject malformed input without including any password text in errors. */
const validatePasswordJson = (contents: string) => {
  try {
    if (isRecord(JSON.parse(contents))) return
  } catch {
    /* Report only the validation failure, never JSON parser excerpts. */
  }
  throw new Error("The local password file must contain a JSON object")
}

/** Send private data only through SSH stdin, capturing all child output. */
const runSSH = (args: string[], input: string) => {
  const result = spawnSync("/usr/bin/ssh", args, {
    encoding: "utf8",
    input,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  })
  if (result.status !== 0)
    throw new Error("Private-file delivery to mini failed; the automatic job will retry")
  return result.stdout
}

/** Hash exact bytes for end-to-end verification. */
const sha256 = (contents: Buffer) => createHash("sha256").update(contents).digest("hex")

/** Check a parsed JSON value before inspecting fields. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** The complete allowlist of private files mirrored to the mini. */
const FILE_NAMES = ["personal-info.md", "low-stakes-passwords.json"]

/** Local sources and the transport used to mirror them. */
type SyncOptions = {
  /** Directory containing the two private files. */
  directory?: string
  /** SSH transport accepting the private payload through stdin. */
  runSSH?: (args: string[], input: string) => string
}
