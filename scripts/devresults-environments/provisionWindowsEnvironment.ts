import { readFile } from "node:fs/promises"
import { runWindowsProvisioning } from "./runWindowsProvisioning.ts"
import { validateSnapshotReceipt } from "./validateSnapshotReceipt.ts"
import type { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Restore verified coordinated data and create owned Windows runtime configuration over SSH. */
export async function provisionWindowsEnvironment(
  /** Reserved identity with paired frozen source. */
  manifest: EnvironmentManifest,
  /** Explicit local receipt and optional dependency injection. */
  options: ProvisionOptions,
) {
  if (!options.snapshot)
    throw new Error(
      "Creation requires --snapshot with a verified coordinated SQL/blob snapshot receipt; existing live environments are never paused automatically",
    )
  const snapshot = validateSnapshotReceipt(
    JSON.parse(await readFile(options.snapshot, "utf8")),
    manifest,
  )
  return runWindowsProvisioning(manifest, {
    ...options,
    snapshot,
    operation: options.operation ?? "provision",
  })
}

/** Private Windows provisioning options. */
export type ProvisionOptions = {
  /** Local JSON receipt certifying the coordinated immutable native Windows snapshot. */
  snapshot?: string
  /** Read-only prerequisite check, or actual provisioning. */
  operation?: "verify" | "provision"
  /** Test transport injection. */
  run?: typeof runWindowsAssetPayload
}
