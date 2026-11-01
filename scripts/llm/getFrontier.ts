import type { Variant } from "./types.ts"

/** Get the variants that no cheaper variant matches or beats, cheapest first. */
export function getFrontier(
  /** Variants to compare. */
  variants: Variant[],
): Variant[] {
  let best = -Infinity
  return [...variants]
    .sort((a, b) => a.costPerTask - b.costPerTask || b.intelligence - a.intelligence)
    .filter(variant => {
      if (variant.intelligence <= best) return false
      best = variant.intelligence
      return true
    })
}
