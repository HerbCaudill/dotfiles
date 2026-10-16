import { closeSync, openSync, readSync, statSync } from "node:fs"
import { summaryReadBytes } from "./constants.ts"
import { parseSession } from "./parse-session.ts"
import type { SessionFile } from "./types.ts"

/** Read enough of a transcript to derive list metadata and its first prompt. */
export function getSessionSummary(
  /** Discovered source file. */
  file: SessionFile,
) {
  if (file.summary)
    return {
      ...file.summary,
      provider: file.provider,
      path: file.path,
      machine: file.machine,
      fileModifiedAt: file.fileModifiedAt!,
    }
  const stats = statSync(file.path)
  const descriptor = openSync(file.path, "r")
  const buffer = Buffer.alloc(Math.min(summaryReadBytes, stats.size))

  try {
    readSync(descriptor, buffer, 0, buffer.length, 0)
  } finally {
    closeSync(descriptor)
  }

  return parseSession(file, buffer.toString("utf8"), false, stats.mtime)
}
