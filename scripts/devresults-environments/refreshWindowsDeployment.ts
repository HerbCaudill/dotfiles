import { runWindowsProvisioning } from "./runWindowsProvisioning.ts"
import type { runDrenvCommand } from "./runDrenvCommand.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Replace the owned deployment after a completed build; refuses any live environment process. */
export function refreshWindowsDeployment(
  /** Environment source must already be at the verified revision. */
  manifest: EnvironmentManifest,
  /** Optional test transport. */
  options: { run?: typeof runDrenvCommand } = {},
) {
  return runWindowsProvisioning(manifest, { ...options, operation: "refresh" })
}
