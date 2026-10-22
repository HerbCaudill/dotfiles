import { execFile } from "node:child_process"
import { mkdtemp, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { expect, test } from "vitest"

test("executes through a directory alias instead of silently succeeding", async () => {
  const root = await mkdtemp(join(tmpdir(), "delegated-gws-entry-"))
  const alias = join(root, "repo")
  await symlink(
    fileURLToPath(new URL("../../../", import.meta.url)),
    alias,
    process.platform === "win32" ? "junction" : "dir",
  )
  const result = await promisify(execFile)(
    process.execPath,
    [join(alias, "scripts/google-workspace/runDelegatedGws.ts"), "--help"],
    {
      env: {
        ...process.env,
        GOOGLE_WORKSPACE_DELEGATED_CREDENTIALS_FILE: join(root, "missing-credentials.json"),
      },
    },
  ).then(
    () => ({ code: 0, stderr: "" }),
    error => ({ code: error.code, stderr: error.stderr }),
  )
  expect(result.code).toBe(1)
  expect(result.stderr).toContain("credentials are unavailable")
})
