import type { SessionFile } from "./types.ts"

/** Split session files into bounded command-line batches. */
export function chunkSessionFiles(
  /** Session files to batch. */
  files: SessionFile[],
  /** Maximum files per batch. */
  maxFiles = 200,
  /** Maximum combined characters used by quoted path arguments. */
  maxCharacters = Number.POSITIVE_INFINITY,
) {
  const chunks: SessionFile[][] = []
  let chunk: SessionFile[] = []
  let characters = 0

  for (const file of files) {
    const fileCharacters = file.path.length + 3
    if (
      chunk.length > 0 &&
      (chunk.length === maxFiles || characters + fileCharacters > maxCharacters)
    ) {
      chunks.push(chunk)
      chunk = []
      characters = 0
    }

    chunk.push(file)
    characters += fileCharacters
  }

  if (chunk.length > 0) chunks.push(chunk)

  return chunks
}
