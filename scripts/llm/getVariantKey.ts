import type { Variant } from "./types.ts"

/** Get a stable identifier for a variant. */
export function getVariantKey(
  /** The variant to identify. */
  variant: Variant,
): string {
  return `${variant.harness}/${variant.model}/${variant.effort}`
}
