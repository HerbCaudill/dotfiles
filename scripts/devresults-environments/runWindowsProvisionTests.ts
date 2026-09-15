import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { runWindowsProvisioning } from "./runWindowsProvisioning.ts"
import type { EnvironmentManifest } from "./types.ts"
import { encodeWindowsScript } from "./encodeWindowsScript.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"

/** Exercise the real PowerShell helper functions using owned Windows temporary files and mocked host inventory. */
export async function runWindowsProvisionTests() {
  const [script, tests] = await Promise.all([
    readFile(new URL("./windows/provision.ps1", import.meta.url), "utf8"),
    readFile(new URL("./windows/provision.tests.ps1", import.meta.url), "utf8"),
  ])
  const command = encodeWindowsScript(`. {
${script.slice(0, script.indexOf("if ($null -eq $Request)"))}
}
& {
${tests}
}`)
  const result = await runDrenvCommand({
    executable: "ssh",
    args: [
      "devresults-vm",
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      command,
    ],
    timeoutMs: 120_000,
  })
  const checks = JSON.parse(result.stdout.trim()) as { passed: number; scope: string }
  let refused = false
  try {
    await runWindowsProvisioning(
      { id: "INVALID", windowsHost: "devresults-vm" } as EnvironmentManifest,
      { operation: "verify" },
    )
  } catch (error) {
    refused =
      error instanceof Error && error.message === "Invalid environment identity or frozen revision."
  }
  if (!refused)
    throw new Error("Windows full payload failed its pre-mutation identity refusal check")
  return { ...checks, passed: checks.passed + 1 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await runWindowsProvisionTests()))
}
