import { getFrontier } from "./getFrontier.ts"
import type { Snapshot, Variant } from "./types.ts"

/** Build a snapshot, keeping the floor fixed until the index version changes. */
export function buildSnapshot(
  /** New scores and the previous snapshot. */
  args: BuildSnapshotArgs,
): Snapshot {
  const { fetchedAt, indexVersion, previous, testedVariantKeys, variants } = args
  // Scores from different index versions aren't comparable, so only then does the floor move.
  const floor =
    previous?.indexVersion === indexVersion
      ? previous.floor
      : getFrontier(variants)[0]?.intelligence
  if (floor === undefined) throw new Error("No runnable models have scores")
  return { fetchedAt, floor, indexVersion, testedVariantKeys, variants }
}

export type BuildSnapshotArgs = {
  /** When the scores were fetched. */
  fetchedAt: string
  /** Artificial Analysis index version. */
  indexVersion: number
  /** The snapshot being replaced. */
  previous?: Snapshot
  /** Variants that have passed a test call. */
  testedVariantKeys?: string[]
  /** All runnable variants. */
  variants: Variant[]
}
