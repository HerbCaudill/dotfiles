import { expect, test } from "vitest"
import { bindPrState } from "../bindPrState.ts"

test("binds legacy checkpoints once and refuses to replay intentions in another space or freshness mode", () => {
  const state = { lastCheckedAt: null, processedEventKeys: ["legacy"], intents: {} }
  const context = { spaceId: "space", freshness: "converged" as const }
  const bound = bindPrState(state, context)
  expect(bound).toMatchObject({ ...state, tasksBinding: context })
  expect(bindPrState(bound, context)).toEqual(bound)
  expect(() => bindPrState(bound, { ...context, spaceId: "other" })).toThrow("binding")
  expect(() => bindPrState(bound, { ...context, freshness: "local" })).toThrow("binding")
})
