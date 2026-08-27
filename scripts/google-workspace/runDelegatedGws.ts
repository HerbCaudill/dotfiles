import { spawnSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { loadServiceAccountCredentials } from "./loadServiceAccountCredentials.ts"
import { requestDelegatedAccessToken } from "./requestDelegatedAccessToken.ts"

/** Run one gws command using a fresh delegated Workspace access token. */
export async function runDelegatedGws(
  /** Arguments passed directly to the installed gws binary. */
  arguments_: ReadonlyArray<string>,
  /** Injectable credential and process boundaries. */
  dependencies: RunDelegatedGwsDependencies = defaultDependencies(),
) {
  const credentials = dependencies.loadCredentials(dependencies.credentialsPath)
  const accessToken = await dependencies.requestAccessToken(credentials, {
    fetch: globalThis.fetch,
    now: dependencies.now(),
    scopes: approvedScopes,
    subject: delegatedUser,
  })
  return dependencies.spawnGws(arguments_, accessToken)
}

/** Build the production dependencies after reading optional environment overrides. */
function defaultDependencies(): RunDelegatedGwsDependencies {
  return {
    credentialsPath:
      process.env.GOOGLE_WORKSPACE_DELEGATED_CREDENTIALS_FILE ?? defaultCredentialsPath,
    loadCredentials: loadServiceAccountCredentials,
    now: () => new Date(),
    requestAccessToken: requestDelegatedAccessToken,
    spawnGws,
  }
}

/** Run the installed gws binary while keeping the access token out of its arguments. */
function spawnGws(arguments_: ReadonlyArray<string>, accessToken: string) {
  const result = spawnSync("gws", arguments_, {
    env: { ...process.env, GOOGLE_WORKSPACE_CLI_TOKEN: accessToken },
    stdio: "inherit",
  })
  return result.status ?? 1
}

// CONSTANTS

const approvedScopes = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/tasks",
] as const

const defaultCredentialsPath = join(
  homedir(),
  ".config",
  "google-workspace-delegation",
  "service-account.json",
)

const delegatedUser = process.env.GOOGLE_WORKSPACE_DELEGATED_USER ?? "herb@devresults.com"

// TYPES

type RunDelegatedGwsDependencies = {
  /** Owner-only service-account JSON key path. */
  credentialsPath: string
  /** Load and validate the service-account key. */
  loadCredentials: typeof loadServiceAccountCredentials
  /** Clock used for delegated token assertions. */
  now: () => Date
  /** Exchange a signed assertion for a short-lived access token. */
  requestAccessToken: typeof requestDelegatedAccessToken
  /** Invoke the installed gws binary with the short-lived token. */
  spawnGws: (arguments_: ReadonlyArray<string>, accessToken: string) => number
}

const invokedPath = process.argv[1]

if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runDelegatedGws(process.argv.slice(2))
    .then(status => {
      process.exitCode = status
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : "Delegated gws command failed")
      process.exitCode = 1
    })
}
