import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import type { ServiceAccountCredentials } from "./createDelegatedJwt.ts"

/** Load one owner-only service-account key without following symbolic links. */
export function loadServiceAccountCredentials(path: string): ServiceAccountCredentials {
  let descriptor: number | undefined
  try {
    const expected = lstatSync(path)
    const expectedUid = process.getuid?.()
    if (
      expected.isSymbolicLink() ||
      !expected.isFile() ||
      (process.platform !== "win32" &&
        (expectedUid === undefined ||
          expected.uid !== expectedUid ||
          (expected.mode & 0o777) !== 0o600))
    )
      invalidCredentials()

    if (process.platform === "win32") verifyWindowsAcl(path)

    descriptor = openSync(path, safeOpenFlags)
    const opened = fstatSync(descriptor)
    if (
      !opened.isFile() ||
      (process.platform !== "win32" && opened.uid !== expectedUid) ||
      opened.dev !== expected.dev ||
      opened.ino !== expected.ino ||
      (process.platform !== "win32" && (opened.mode & 0o777) !== 0o600)
    )
      invalidCredentials()

    if (process.platform === "win32") verifyWindowsAcl(path)

    const value = JSON.parse(readFileSync(descriptor, "utf8")) as Record<string, unknown>
    if (
      value.type !== "service_account" ||
      typeof value.client_email !== "string" ||
      !value.client_email ||
      typeof value.private_key !== "string" ||
      !value.private_key
    )
      invalidCredentials()

    return { clientEmail: value.client_email, privateKey: value.private_key }
  } catch {
    invalidCredentials()
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor)
      } catch {
        // The descriptor belongs only to this short-lived credential read.
      }
    }
  }
}

/** Check Windows ownership and explicit access before reading any key material. */
function verifyWindowsAcl(path: string) {
  const result = spawnSync(
    "C:/Program Files/PowerShell/7/pwsh.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-File",
      fileURLToPath(new URL("./verifyCredentialAcl.ps1", import.meta.url)),
    ],
    {
      env: { ...process.env, GWS_CREDENTIAL_FILE: path },
      stdio: "ignore",
      windowsHide: true,
    },
  )
  if (result.status !== 0) invalidCredentials()
}

/** Fail without including paths, metadata, or credential content. */
function invalidCredentials(): never {
  throw new Error("Google Workspace service-account credentials are unavailable")
}

const safeOpenFlags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)
