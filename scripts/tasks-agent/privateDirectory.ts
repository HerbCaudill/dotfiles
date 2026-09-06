import { lstat } from "node:fs/promises"

/** Refuse public, unowned or redirected installation directories before reading or writing releases. */
export async function privateDirectory(
  /** Directory that must already exist. */
  path: string,
) {
  const info = await lstat(path)
  if (!info.isDirectory() || info.uid !== process.getuid?.() || info.mode & 0o077)
    throw new Error(
      "Installation directories must be private, owned by this user and not symlinks.",
    )
}
