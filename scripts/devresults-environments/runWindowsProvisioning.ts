import { readFile } from "node:fs/promises"
import { encodeWindowsScript } from "./encodeWindowsScript.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import type { EnvironmentManifest } from "./types.ts"
import type { SnapshotReceipt } from "./validateSnapshotReceipt.ts"

/** Invoke the versioned Windows payload without interpolating user data into executable PowerShell. */
export async function runWindowsProvisioning(
  /** Reserved environment identity. */
  manifest: EnvironmentManifest,
  /** One guarded operation and its optional coordinated snapshot. */
  options: {
    operation: "verify" | "provision" | "refresh"
    snapshot?: SnapshotReceipt
    run?: typeof runDrenvCommand
  },
): Promise<ProvisionResult> {
  const script = await readFile(new URL("./windows/provision.ps1", import.meta.url), "utf8")
  const command = encodeWindowsScript(`$request = [Console]::In.ReadToEnd() | ConvertFrom-Json; & {
${script}
} -Request $request`)
  const result = await (options.run ?? runDrenvCommand)({
    executable: "ssh",
    args: [
      manifest.windowsHost,
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      command,
    ],
    input: JSON.stringify({
      manifest,
      snapshot: options.snapshot ?? null,
      operation: options.operation,
    }),
    timeoutMs: 3_600_000,
  })
  let response: ProvisionResult
  try {
    response = JSON.parse(result.stdout.trim())
  } catch {
    throw new Error(
      "Windows provisioning did not return a verified receipt; inspect the owned Windows journal before retrying",
    )
  }
  if (!response.ok)
    throw new Error(
      response.prerequisite ?? "Windows provisioning refused; inspect the owned Windows journal",
    )
  const expectedStatus = { verify: "verified", provision: "provisioned", refresh: "refreshed" }[
    options.operation
  ]
  if (
    response.environmentId !== manifest.id ||
    response.ownerToken !== manifest.ownerToken ||
    response.revision !== manifest.revision ||
    response.status !== expectedStatus
  )
    throw new Error("Windows provisioning receipt does not match the environment")
  return response
}

/** Sanitized Windows result; connection strings never enter this receipt. */
export type ProvisionResult = {
  /** Whether all requested checks/effects completed. */
  ok: boolean
  /** Stable environment ID. */
  environmentId: string
  /** Reserved ownership token. */
  ownerToken: string
  /** Frozen source revision. */
  revision: string
  /** Data/config state, never proof of build compatibility or a running app. */
  status: "verified" | "provisioned" | "refreshed"
  /** Concrete actionable refusal with no command output or credentials. */
  prerequisite?: string
}
