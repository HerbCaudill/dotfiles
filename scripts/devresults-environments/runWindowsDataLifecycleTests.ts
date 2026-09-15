import { readFile } from "node:fs/promises"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"

const [provision, lifecycle, tests] = await Promise.all(
  ["provision.ps1", "lifecycle.ps1", "data-lifecycle.tests.ps1"].map(name =>
    readFile(new URL(`./windows/${name}`, import.meta.url), "utf8"),
  ),
)
const result = await runWindowsAssetPayload(
  ". ([ScriptBlock]::Create($r.helpers)); . ([ScriptBlock]::Create($r.lifecycle)); try { & ([ScriptBlock]::Create($r.tests)) } catch { @{failed=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber} | ConvertTo-Json -Compress }",
  {
    helpers: provision.slice(0, provision.indexOf("if ($null -eq $Request)")),
    lifecycle: lifecycle.slice(0, lifecycle.indexOf("\n$lock=$null")),
    tests,
  },
  { timeoutMs: 180_000 },
)
const response = JSON.parse(result.stdout.trim())
console.log(JSON.stringify(response))
if (response.failed) process.exitCode = 1
