import type { EnvironmentManifest } from "./types.ts"
import type { SourceOptions } from "./sourceTypes.ts"
import { operateEnvironmentSource } from "./operateEnvironmentSource.ts"

/** Create or resume a native worktree pair without committing dirty source changes. Caller holds the environment lock. */
export async function pairEnvironmentSource(
  /** Reserved registry identity. */
  manifest: EnvironmentManifest,
  /** Explicit native Mac checkout whose revision will be frozen. */
  source: string,
  /** Optional transport adapter. */
  options: SourceOptions = {},
): Promise<string> {
  return operateEnvironmentSource(manifest, "pair", source, options)
}
