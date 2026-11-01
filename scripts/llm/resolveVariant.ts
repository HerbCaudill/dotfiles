import type { Snapshot, Variant } from "./types.ts"

/** Pick the cheapest variant that reaches a level on the 0–100 scale. */
export function resolveVariant(
  /** Scores and scale. */
  snapshot: Snapshot,
  /** Required level and any harness limits. */
  args: ResolveVariantArgs,
): Variant {
  const { excludedHarnesses = [], harness, level } = args
  if (!(level >= 0 && level <= 100)) throw new Error("Level must be between 0 and 100")

  const available = snapshot.variants.filter(
    variant =>
      !excludedHarnesses.includes(variant.harness) && (!harness || variant.harness === harness),
  )
  if (available.length === 0) throw new Error("No model is available for this request")

  // The scale uses every harness, so a level means the same thing when a caller pins one.
  const top = Math.max(...snapshot.variants.map(variant => variant.intelligence))
  const target = snapshot.floor + (level / 100) * (top - snapshot.floor)
  const reachesTarget = available.filter(variant => variant.intelligence >= target)
  if (reachesTarget.length === 0)
    return available.reduce((best, variant) =>
      variant.intelligence > best.intelligence ? variant : best,
    )

  return reachesTarget.reduce((best, variant) =>
    variant.costPerTask < best.costPerTask ||
    (variant.costPerTask === best.costPerTask && variant.intelligence > best.intelligence)
      ? variant
      : best,
  )
}

export type ResolveVariantArgs = {
  /** Harnesses that can't be used for this attempt. */
  excludedHarnesses?: string[]
  /** Stay on this harness. */
  harness?: string
  /** Required intelligence from 0 to 100. */
  level: number
}
