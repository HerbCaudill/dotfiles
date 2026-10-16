import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { stripBinaryContent } from "./stripBinaryContent.ts"
import { toReadableTranscriptRecord } from "./toReadableTranscriptRecord.ts"

/** Stream readable harness records while tolerating an unfinished final JSONL record. */
export async function* readTextTranscript(
  /** Read-only source transcript. */
  path: string,
  /** Harness whose conversation fields should be retained. */
  provider?: "claude" | "codex",
) {
  const input = createReadStream(path)
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      if (!line.trim()) continue
      try {
        const record = toReadableTranscriptRecord(JSON.parse(line), provider)
        if (record) yield `${JSON.stringify(stripBinaryContent(record))}\n`
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
    }
  } finally {
    lines.close()
    input.destroy()
  }
}
