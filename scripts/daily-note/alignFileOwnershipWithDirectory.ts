import { chownSync, statSync } from "node:fs"

/** Match a file's ownership to its parent daily note directory when running as root. */
export const alignFileOwnershipWithDirectory = (
  /** The file whose ownership should be updated. */
  filePath: string,
  /** The daily note directory whose ownership should be copied. */
  directoryPath: string,
): void => {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) {
    return
  }

  const directoryStats = statSync(directoryPath)
  chownSync(filePath, directoryStats.uid, directoryStats.gid)
}
