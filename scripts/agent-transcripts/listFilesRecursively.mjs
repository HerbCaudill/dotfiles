import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

/** Recursively list all files beneath a directory. */
export const listFilesRecursively = (
  /** The directory to walk. */
  directoryPath,
) => {
  if (!existsSync(directoryPath)) {
    return []
  }

  return readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
    const entryPath = join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      return listFilesRecursively(entryPath)
    }

    return [entryPath]
  })
}
