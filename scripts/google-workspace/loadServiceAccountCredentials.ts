import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from "node:fs"

import type { ServiceAccountCredentials } from "./createDelegatedJwt.ts"

/** Load one owner-only service-account key without following symbolic links. */
export function loadServiceAccountCredentials(path: string): ServiceAccountCredentials {
  let descriptor: number | undefined
  try {
    const expected = lstatSync(path)
    const expectedUid = process.getuid?.()
    if (
      expectedUid === undefined ||
      expected.isSymbolicLink() ||
      !expected.isFile() ||
      expected.uid !== expectedUid ||
      (expected.mode & 0o777) !== 0o600
    )
      invalidCredentials()

    descriptor = openSync(path, safeOpenFlags)
    const opened = fstatSync(descriptor)
    if (
      !opened.isFile() ||
      opened.uid !== expectedUid ||
      opened.dev !== expected.dev ||
      opened.ino !== expected.ino ||
      (opened.mode & 0o777) !== 0o600
    )
      invalidCredentials()

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

/** Fail without including paths, metadata, or credential content. */
function invalidCredentials(): never {
  throw new Error("Google Workspace service-account credentials are unavailable")
}

const safeOpenFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
