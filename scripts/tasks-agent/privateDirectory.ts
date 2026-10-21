import { lstat } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

/** Refuse public, unowned or redirected installation directories before reading or writing releases. */
export async function privateDirectory(
  /** Directory that must already exist. */
  path: string,
) {
  const info = await lstat(path)
  if (process.platform === "win32") {
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Installation directories cannot be redirected.")
    await promisify(execFile)(
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        fileURLToPath(new URL("../windows/private-directory.ps1", import.meta.url)),
      ],
      { env: { ...process.env, AGENT_PRIVATE_DIRECTORY: path }, windowsHide: true },
    )
    return
  }
  if (!info.isDirectory() || info.uid !== process.getuid?.() || info.mode & 0o077)
    throw new Error(
      "Installation directories must be private, owned by this user and not symlinks.",
    )
}
