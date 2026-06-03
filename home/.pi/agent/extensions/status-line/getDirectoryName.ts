/** Get the display name for a working directory. */
export function getDirectoryName(
  /** The current working directory. */
  cwd: string,
): string {
  return cwd.split("/").filter(Boolean).at(-1) ?? cwd
}
