import { buildSnapshot } from "./buildSnapshot.ts"
import { getFrontier } from "./getFrontier.ts"
import { getVariantKey } from "./getVariantKey.ts"
import type { Snapshot, Variant } from "./types.ts"

/** Build a new snapshot from scores, test-calling every variant that could be picked. */
export async function refreshFrontier(
  /** New scores, the previous snapshot and how to test a variant. */
  args: RefreshFrontierArgs,
): Promise<Snapshot> {
  const { fetchedAt, indexVersion, log, previous, test } = args
  const tested = new Set(previous?.testedVariantKeys ?? [])
  let variants = args.variants

  // Dropping a variant can put another on the frontier, so this repeats until all picks have passed.
  while (true) {
    const untested = getPickableVariants(variants).find(
      variant => !tested.has(getVariantKey(variant)),
    )
    if (!untested) break

    const result = await test(untested)
    if (result === "limited")
      throw new Error(`Usage limit reached while testing ${getVariantKey(untested)}`)
    if (result === "passed") {
      tested.add(getVariantKey(untested))
    } else {
      log(`Dropped ${getVariantKey(untested)}: test call failed`)
      variants = variants.filter(variant => variant !== untested)
    }
  }

  return buildSnapshot({
    fetchedAt,
    indexVersion,
    previous,
    testedVariantKeys: [...tested],
    variants,
  })
}

/** Get every variant a caller could end up on, with or without pinning a harness. */
function getPickableVariants(
  /** All runnable variants. */
  variants: Variant[],
): Variant[] {
  const harnesses = [...new Set(variants.map(variant => variant.harness))]
  return [
    ...getFrontier(variants),
    ...harnesses.flatMap(harness =>
      getFrontier(variants.filter(variant => variant.harness === harness)),
    ),
  ]
}

export type RefreshFrontierArgs = {
  /** When the scores were fetched. */
  fetchedAt: string
  /** Artificial Analysis index version. */
  indexVersion: number
  /** Write a diagnostic line. */
  log: (message: string) => void
  /** The snapshot being replaced. */
  previous?: Snapshot
  /** Make a small real call on a variant. */
  test: (variant: Variant) => Promise<"passed" | "failed" | "limited">
  /** All runnable variants. */
  variants: Variant[]
}
