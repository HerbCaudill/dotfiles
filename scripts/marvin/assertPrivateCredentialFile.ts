import { chmodSync, lstatSync } from "node:fs"
import { pathToFileURL } from "node:url"

/** Require one regular, owner-only credential file without following symbolic links. */
export function assertPrivateCredentialFile(
  /** Credential file whose contents must remain private. */
  path: string,
  /** Numeric user ID that must own the file. */
  expectedUid = requiredUid(),
) {
  const stat = assertCredentialIdentity(path, expectedUid)
  if ((stat.mode & 0o777) !== 0o600) invalidCredentials()
}

/** Run the intentionally small validation and activation-repair CLI. */
function main(arguments_: string[]) {
  const [operation, path, expectedUidText, ...extra] = arguments_
  const expectedUid = Number(expectedUidText)
  if (
    extra.length > 0 ||
    !path ||
    !Number.isSafeInteger(expectedUid) ||
    expectedUid < 0 ||
    (operation !== "--check" && operation !== "--repair-mode")
  )
    invalidCredentials()
  if (operation === "--repair-mode") repairPrivateCredentialFile(path, expectedUid)
  else assertPrivateCredentialFile(path, expectedUid)
}

/** Tighten an already trustworthy file, refusing unsafe identity or file types first. */
function repairPrivateCredentialFile(path: string, expectedUid: number) {
  assertCredentialIdentity(path, expectedUid)
  chmodSync(path, 0o600)
  assertPrivateCredentialFile(path, expectedUid)
}

/** Validate immutable identity properties before any mode repair. */
function assertCredentialIdentity(path: string, expectedUid: number) {
  let stat: ReturnType<typeof lstatSync>
  try {
    stat = lstatSync(path)
  } catch {
    invalidCredentials()
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.uid !== expectedUid) invalidCredentials()
  return stat
}

/** Read the current process user ID or fail closed. */
function requiredUid() {
  const uid = process.getuid?.()
  if (uid === undefined) invalidCredentials()
  return uid
}

/** Fail without including a path, owner, mode, or credential content. */
function invalidCredentials(): never {
  throw new Error(safeError)
}

// CONSTANTS

const safeError = "Marvin digest credentials are unavailable"
const invokedPath = process.argv[1]

if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try {
    main(process.argv.slice(2))
  } catch {
    process.stderr.write(`${safeError}\n`)
    process.exitCode = 1
  }
}
