import { readFile } from "node:fs/promises"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"

/** Exercise client build selection against actual Git revisions in a disposable Windows checkout. */
const lifecycle = await readFile(new URL("./windows/lifecycle.ps1", import.meta.url), "utf8")
const tests = await readFile(new URL("./windows/client-build.tests.ps1", import.meta.url), "utf8")
const helper = lifecycle.slice(
  lifecycle.indexOf("function Test-ClientOnlyRevision"),
  lifecycle.indexOf("function Build-OwnedSource"),
)
const result = await runWindowsAssetPayload(
  "$ErrorActionPreference='Stop'; . ([ScriptBlock]::Create($r.helper)); try { & ([ScriptBlock]::Create($r.tests)) } catch { @{failed=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber} | ConvertTo-Json -Compress }",
  { helper, tests },
  { timeoutMs: 120_000 },
)
const response = JSON.parse(result.stdout.trim())
if (response.failed)
  throw new Error(`Windows client build test failed: ${response.failed} (line ${response.line})`)
console.log(JSON.stringify(response))
