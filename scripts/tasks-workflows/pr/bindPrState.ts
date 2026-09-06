import type { PrState } from "./types.ts"

/** Preserve the service context of stored intentions across restarts and deployment changes. */
export function bindPrState(
  /** Validated legacy checkpoint or an existing Tasks checkpoint. */
  state: PrState,
  /** Reviewed public binding and explicit evidence requirement. */
  context: { spaceId: string; freshness: "local" | "edge-upload" | "converged" },
): PrState {
  const binding = state.tasksBinding as { spaceId?: unknown; freshness?: unknown } | undefined
  if (binding !== undefined) {
    if (!binding || binding.spaceId !== context.spaceId || binding.freshness !== context.freshness)
      throw new Error(
        "PR checkpoint binding differs; review it before changing the service context",
      )
    return state
  }
  if (Object.keys(state.intents).length)
    throw new Error("PR intention binding is missing; preserve it for inspection")
  return { ...state, tasksBinding: { ...context } }
}
