import { expect, test } from "vitest"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

test("invalid management options never echo credential-shaped input", async () => {
  const marker = "private-invitation-material"
  const result = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL("../main.ts", import.meta.url)),
    `--${marker}`,
  ]).catch(error => ({ stdout: error.stdout, stderr: error.stderr }))
  expect((result.stdout + result.stderr).includes(marker)).toBe(false)
  expect(result.stderr).toContain("options")
})
