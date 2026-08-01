/** Parse complete JSON objects from JSONL while tolerating a partial final line. */
export function parseJsonLines(
  /** JSONL text, which may be a file prefix. */
  text: string,
) {
  const records: Record<string, unknown>[] = []

  for (const line of text.split("\n")) {
    if (!line.trim()) continue

    try {
      const value: unknown = JSON.parse(line)
      if (value && typeof value === "object") {
        records.push(value as Record<string, unknown>)
      }
    } catch {
      // A live log or prefix read may end midway through a JSON object.
    }
  }

  return records
}
