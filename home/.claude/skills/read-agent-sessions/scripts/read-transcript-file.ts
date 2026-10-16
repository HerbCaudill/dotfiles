import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { SessionFile } from "./types.ts"

/** Read a live JSONL file or reassemble and decompress an archived transcript. */
export function readTranscriptFile(
  /** Discovered transcript and optional gzip fragment paths. */
  file: SessionFile,
) {
  if (file.parts)
    return gunzipSync(Buffer.concat(file.parts.map(path => readFileSync(path)))).toString("utf8")
  return readFileSync(file.path, "utf8")
}
