import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { stripBinaryContent } from "./stripBinaryContent.ts"

/** Stream readable harness records while tolerating an unfinished final JSONL record. */
export async function* readTextTranscript(
  /** Read-only source transcript. */
  path: string,
) {
  const input = createReadStream(path)
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      if (!line.trim()) continue
      try {
        yield `${JSON.stringify(stripBinaryContent(JSON.parse(line)))}\n`
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
    }
  } finally {
    lines.close()
    input.destroy()
  }
}
