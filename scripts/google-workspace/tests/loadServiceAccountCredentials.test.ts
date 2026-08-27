import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

import { loadServiceAccountCredentials } from "../loadServiceAccountCredentials.ts"

const cleanups: Array<() => void> = []

afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach(cleanup => cleanup())
})

describe("loadServiceAccountCredentials", () => {
  test("loads the required fields from an owner-only service-account key", () => {
    const path = createFixture({
      client_email: "briefing@example.iam.gserviceaccount.com",
      private_key: "private-key",
      private_key_id: "ignored",
      type: "service_account",
    })

    expect(loadServiceAccountCredentials(path)).toEqual({
      clientEmail: "briefing@example.iam.gserviceaccount.com",
      privateKey: "private-key",
    })
  })

  test("refuses credentials readable by the owner group or other users", () => {
    const path = createFixture({
      client_email: "briefing@example.iam.gserviceaccount.com",
      private_key: "private-key",
      type: "service_account",
    })
    chmodSync(path, 0o644)

    expect(() => loadServiceAccountCredentials(path)).toThrow(safeError)
  })

  test("reports malformed credentials without including their contents", () => {
    const path = createFixture({ private_key: "do-not-log" })

    expect(() => loadServiceAccountCredentials(path)).toThrow(safeError)
  })
})

/** Create one private credential fixture and register its cleanup. */
function createFixture(value: object) {
  const directory = mkdtempSync(join(tmpdir(), "google-workspace-credentials-"))
  cleanups.push(() => rmSync(directory, { force: true, recursive: true }))
  const path = join(directory, "service-account.json")
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 })
  return path
}

const safeError = "Google Workspace service-account credentials are unavailable"
