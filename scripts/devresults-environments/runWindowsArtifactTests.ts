import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"

/** Verify both client build layouts using disposable Windows files only. */
export async function runWindowsArtifactTests() {
  const [lifecycle, tests] = await Promise.all(
    ["lifecycle.ps1", "artifacts.tests.ps1"].map(name =>
      readFile(new URL(`./windows/${name}`, import.meta.url), "utf8"),
    ),
  )
  const helper = lifecycle.slice(
    lifecycle.indexOf("function Get-BuildArtifacts"),
    lifecycle.indexOf("function Get-AppBuildRecipe"),
  )
  const result = await runWindowsAssetPayload(
    "$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest; function Deny($Message){throw $Message}; . ([ScriptBlock]::Create($r.helper)); try { & ([ScriptBlock]::Create($r.tests)) } catch { @{failed=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber} | ConvertTo-Json -Compress }",
    { helper, tests },
    { timeoutMs: 120_000 },
  )
  const response = JSON.parse(result.stdout.trim())
  if (response.failed)
    throw new Error(`Windows artifact fixture failed: ${response.failed} (line ${response.line})`)
  return response
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await runWindowsArtifactTests()))
