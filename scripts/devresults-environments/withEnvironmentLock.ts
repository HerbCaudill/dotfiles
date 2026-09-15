import { join } from "node:path"
import { assertEnvironmentId } from "./assertEnvironmentId.ts"
import { withRegistryLock } from "./withRegistryLock.ts"

/** Serialize complete lifecycle operations for one ID while allowing other environments to progress. */
export function withEnvironmentLock<T>(
  /** Canonical personal registry directory. */
  directory: string,
  /** Explicit target environment ID. */
  id: string,
  /** Complete lifecycle operation; registry checkpoints take their own short transaction lock. */
  operation: () => Promise<T>,
): Promise<T> {
  assertEnvironmentId(id)
  return withRegistryLock(join(directory, "operations", id), operation)
}
