import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import type { SessionFile } from "./types.ts"

/** Narrow transcript files with ripgrep before structured parsing. */
export function findMatchingSessionFiles(
  /** Candidate transcript files. */
  files: SessionFile[],
  /** Literal case-insensitive search query. */
  query: string,
) {
  const matches = new Set<string>()
  let useFallback = false

  for (let index = 0; index < files.length; index += 200) {
    const chunk = files.slice(index, index + 200)
    const result = spawnSync(
      "rg",
      [
        "--files-with-matches",
        "--ignore-case",
        "--fixed-strings",
        "--",
        query,
        ...chunk.map(file => file.path),
      ],
      {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    )

    if (result.error) {
      useFallback = true
      break
    }

    if (result.status !== 0 && result.status !== 1) {
      throw new Error(result.stderr.trim() || "ripgrep search failed")
    }

    for (const path of result.stdout.split("\n")) {
      if (path) matches.add(path)
    }
  }

  if (useFallback) {
    const normalizedQuery = query.toLocaleLowerCase()
    for (const file of files) {
      if (readFileSync(file.path, "utf8").toLocaleLowerCase().includes(normalizedQuery)) {
        matches.add(file.path)
      }
    }
  }

  return files.filter(file => matches.has(file.path))
}
