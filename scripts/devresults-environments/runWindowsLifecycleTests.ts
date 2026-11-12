import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"

/** Verify actual Windows process containment and scheduled supervision with disposable fixtures. */
export async function runWindowsLifecycleTests() {
  const [provision, lifecycle, supervisor, job, tests] = await Promise.all(
    ["provision.ps1", "lifecycle.ps1", "supervisor.ps1", "OwnedJob.cs", "lifecycle.tests.ps1"].map(
      name => readFile(new URL(`./windows/${name}`, import.meta.url), "utf8"),
    ),
  )
  const result = await runWindowsAssetPayload(
    // The fixtures create real firewall rules and scheduled tasks, which Windows refuses without elevation.
    "if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){ @{failed='These tests create firewall rules and scheduled tasks, so they need an elevated shell: elevated SSH, or Start-Process -Verb RunAs on the host'} | ConvertTo-Json -Compress; return }; " +
      ". ([ScriptBlock]::Create($r.helpers)); . ([ScriptBlock]::Create($r.lifecycle)); try { & ([ScriptBlock]::Create($r.tests)) -Assets $r.assets } catch { @{failed=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber} | ConvertTo-Json -Compress }",
    {
      helpers: provision.slice(0, provision.indexOf("if ($null -eq $Request)")),
      lifecycle: lifecycle.slice(0, lifecycle.indexOf("\n$lock=$null")),
      tests,
      assets: { supervisor, job },
    },
    // A passing run takes about 1.6 minutes on mini, so the old 2-minute limit cut off cold runs.
    { timeoutMs: 600_000 },
  )
  const response = JSON.parse(result.stdout.trim())
  if (response.failed)
    throw new Error(
      `Windows lifecycle fixture failed: ${response.failed}${response.line ? ` (line ${response.line})` : ""}`,
    )
  return response
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await runWindowsLifecycleTests()))
