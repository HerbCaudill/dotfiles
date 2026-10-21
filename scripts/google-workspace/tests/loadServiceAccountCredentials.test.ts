import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
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

  test.skipIf(process.platform === "win32")(
    "refuses credentials readable by the owner group or other users",
    () => {
      const path = createFixture({
        client_email: "briefing@example.iam.gserviceaccount.com",
        private_key: "private-key",
        type: "service_account",
      })
      chmodSync(path, 0o644)

      expect(() => loadServiceAccountCredentials(path)).toThrow(safeError)
    },
  )

  test("reports malformed credentials without including their contents", () => {
    const path = createFixture({ private_key: "do-not-log" })

    expect(() => loadServiceAccountCredentials(path)).toThrow(safeError)
  })

  test.runIf(process.platform === "win32")("refuses a key with inherited Windows access", () => {
    const path = createFixture({
      type: "service_account",
      client_email: "test@example.com",
      private_key: "private-key",
    })
    const result = spawnSync(
      "C:/Program Files/PowerShell/7/pwsh.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$acl = Get-Acl -LiteralPath $env:GWS_TEST_KEY; $acl.SetAccessRuleProtection($false,$true); [IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]::new($env:GWS_TEST_KEY),$acl)",
      ],
      { env: { ...process.env, GWS_TEST_KEY: path } },
    )
    expect(result.status, result.stderr?.toString()).toBe(0)
    expect(() => loadServiceAccountCredentials(path)).toThrow(safeError)
  })
})

/** Create one private credential fixture and register its cleanup. */
function createFixture(value: object) {
  const directory = mkdtempSync(join(tmpdir(), "google-workspace-credentials-"))
  cleanups.push(() => rmSync(directory, { force: true, recursive: true }))
  const path = join(directory, "service-account.json")
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 })
  if (process.platform === "win32") {
    const result = spawnSync(
      "C:/Program Files/PowerShell/7/pwsh.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User; $acl = Get-Acl -LiteralPath $env:GWS_TEST_KEY; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($rule) }; foreach ($id in @($sid.Value,'S-1-5-18','S-1-5-32-544')) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($id),'FullControl','Allow')) }; [IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]::new($env:GWS_TEST_KEY),$acl)",
      ],
      { env: { ...process.env, GWS_TEST_KEY: path }, encoding: "utf8" },
    )
    if (result.status !== 0)
      throw new Error(`Failed to protect test fixture: ${result.stderr} ${result.error?.message}`)
  }
  return path
}

const safeError = "Google Workspace service-account credentials are unavailable"
