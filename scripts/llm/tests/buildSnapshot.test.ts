import { expect, test } from "vitest"
import { buildSnapshot } from "../buildSnapshot.ts"
import type { Snapshot, Variant } from "../types.ts"

const luna: Variant = {
  costPerTask: 0.005,
  effort: "low",
  harness: "codex",
  intelligence: 9.7,
  model: "gpt-6-luna",
}
const sol: Variant = {
  costPerTask: 1.27,
  effort: "max",
  harness: "codex",
  intelligence: 54.5,
  model: "gpt-6.1-sol",
}
const weak: Variant = { ...luna, costPerTask: 0.001, intelligence: 3, model: "gpt-tiny" }
const fetchedAt = "2026-11-02T00:00:00.000Z"
const previous: Snapshot = {
  fetchedAt: "2026-11-01T00:00:00.000Z",
  floor: 9.7,
  indexVersion: 5,
  variants: [luna, sol],
}

test("sets the first floor from the cheapest frontier variant", () => {
  expect(buildSnapshot({ fetchedAt, indexVersion: 5, variants: [sol, luna] }).floor).toBe(9.7)
})

test("keeps the floor when a weaker model appears", () => {
  const variants = [weak, luna, sol]
  expect(buildSnapshot({ fetchedAt, indexVersion: 5, previous, variants }).floor).toBe(9.7)
})

test("resets the floor when the index version changes", () => {
  const rescored = { ...luna, intelligence: 12 }
  const variants = [rescored, sol]
  expect(buildSnapshot({ fetchedAt, indexVersion: 6, previous, variants }).floor).toBe(12)
})
