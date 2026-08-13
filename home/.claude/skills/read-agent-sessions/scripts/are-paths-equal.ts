import { posix, win32 } from "node:path"

/** Compare two filesystem paths using the selected platform's path rules. */
export function arePathsEqual(
  /** First path. */
  left: string,
  /** Second path. */
  right: string,
  /** Filesystem platform. */
  platform: NodeJS.Platform = process.platform,
) {
  const path = platform === "win32" ? win32 : posix
  const normalizedLeft = path.resolve(left)
  const normalizedRight = path.resolve(right)

  return platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight
}
