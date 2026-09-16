import { readFile } from "node:fs/promises"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Execute versioned Windows lifecycle code with owned runtime assets supplied privately on stdin. */
export async function runWindowsLifecycle(
  /** Validated manifest. */
  manifest: EnvironmentManifest,
  /** One lifecycle action. */
  operation: string,
): Promise<{ status: string; snapshot?: unknown }> {
  const [provision, script, supervisor, job, schema, refresh] = await Promise.all(
    [
      "provision.ps1",
      "lifecycle.ps1",
      "supervisor.ps1",
      "OwnedJob.cs",
      "SchemaProbe.cs",
      "refresh.ps1",
    ].map(name => readFile(new URL(`./windows/${name}`, import.meta.url), "utf8")),
  )
  const helpers = provision.slice(0, provision.indexOf("if ($null -eq $Request)"))
  const result = await runWindowsAssetPayload(
    ". ([ScriptBlock]::Create($r.assets.helpers)); . ([ScriptBlock]::Create($r.assets.refresh)); & ([ScriptBlock]::Create($r.assets.lifecycle)) -Request $r",
    {
      manifest,
      operation,
      assets: { supervisor, job, schema, refresh, helpers, lifecycle: script },
    },
    { host: manifest.windowsHost, timeoutMs: operation === "refresh-db" ? 4_000_000 : undefined },
  )
  let response
  try {
    response = JSON.parse(result.stdout.trim())
  } catch {
    throw new Error(
      "Windows lifecycle response was interrupted; inspect owned operation/supervisor receipts before retry",
    )
  }
  if (!response.ok)
    throw new Error(response.prerequisite ?? "Windows lifecycle failed; inspect owned receipts")
  if (response.environmentId !== manifest.id || response.ownerToken !== manifest.ownerToken)
    throw new Error("Windows lifecycle returned foreign ownership")
  return response
}
