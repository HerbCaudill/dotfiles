import { closeSync, constants, fchmodSync, fstatSync, lstatSync, openSync } from "node:fs"
import { marvinCredentialError } from "./constants.ts"

/** Tighten the exact opened credential entry without following a substituted symbolic link. */
export function repairPrivateCredentialFile(
  /** Credential path whose current entry must be secured. */
  path: string,
  /** Numeric user ID that must own the entry and opened file. */
  expectedUid: number,
  /** Test-only scheduling hook injected before the no-follow open boundary. */
  options: RepairPrivateCredentialFileOptions = {},
) {
  const expected = credentialIdentity(path, expectedUid)
  options.beforeOpen?.()
  let descriptor: number
  try {
    descriptor = openSync(path, safeOpenFlags)
  } catch {
    invalidCredentials()
  }
  try {
    const opened = fstatSync(descriptor)
    assertSameCredential(opened, expected, expectedUid)
    fchmodSync(descriptor, 0o600)
    const secured = fstatSync(descriptor)
    assertSameCredential(secured, expected, expectedUid)
    if ((secured.mode & 0o777) !== 0o600) invalidCredentials()
    const current = credentialIdentity(path, expectedUid)
    assertSameCredential(current, expected, expectedUid)
    if ((current.mode & 0o777) !== 0o600) invalidCredentials()
  } catch {
    invalidCredentials()
  } finally {
    try {
      closeSync(descriptor)
    } catch {
      // The descriptor is owned only by this short-lived process; validation has already failed closed.
    }
  }
}

/** Read and validate the path entry without following symbolic links. */
function credentialIdentity(path: string, expectedUid: number) {
  let stat: ReturnType<typeof lstatSync>
  try {
    stat = lstatSync(path)
  } catch {
    invalidCredentials()
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.uid !== expectedUid) invalidCredentials()
  return stat
}

/** Bind a descriptor or final path entry to the exact initially inspected inode. */
function assertSameCredential(
  actual: ReturnType<typeof lstatSync>,
  expected: ReturnType<typeof lstatSync>,
  expectedUid: number,
) {
  if (
    !actual.isFile() ||
    actual.uid !== expectedUid ||
    actual.dev !== expected.dev ||
    actual.ino !== expected.ino
  )
    invalidCredentials()
}

/** Fail without including a path, owner, mode, or credential content. */
function invalidCredentials(): never {
  throw new Error(marvinCredentialError)
}

// CONSTANTS

const safeOpenFlags =
  constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK | constants.O_CLOEXEC

// TYPES

type RepairPrivateCredentialFileOptions = {
  /** Deterministically exercise entry substitution immediately before open. */
  beforeOpen?: () => void
}
