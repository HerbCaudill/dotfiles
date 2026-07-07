import { readFileSync } from "node:fs"

/** Read a JSON file, returning null when it cannot be read or parsed. */
export function readJsonFile<T>(
  /** The file path */
  path: string,
) {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return null
  }
}
