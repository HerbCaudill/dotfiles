import type { EnvironmentManifest } from "./types.ts"
import type { SourceOptions } from "./sourceTypes.ts"
import { operateEnvironmentSource } from "./operateEnvironmentSource.ts"

/** Fast-forward only the registered Windows destination to clean committed Mac HEAD. Caller holds the environment lock. */
export async function syncEnvironmentSource(
  /** Registered source pair. */
  manifest: EnvironmentManifest,
  /** Optional transport adapter. */
  options: SourceOptions = {},
): Promise<string> {
  return operateEnvironmentSource(manifest, "sync", manifest.paths.mac, options)
}
