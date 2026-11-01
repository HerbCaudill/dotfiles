import { expect, test } from "vitest"
import { refreshFrontier } from "../refreshFrontier.ts"
import type { Variant } from "../types.ts"

const luna: Variant = {
  costPerTask: 0.005,
  effort: "low",
  harness: "codex",
  intelligence: 9.7,
  model: "gpt-6-luna",
}
const opus: Variant = {
  costPerTask: 10,
  effort: "max",
  harness: "claude",
  intelligence: 58.4,
  model: "claude-opus-5-5",
}
const retired: Variant = { ...opus, intelligence: 60, model: "claude-retired" }
const args = { fetchedAt: "2026-11-02T00:00:00.000Z", indexVersion: 5, log: () => {} }

test("drops a variant that fails its test and replaces the top of the scale", async () => {
  const snapshot = await refreshFrontier({
    ...args,
    test: async variant => (variant === retired ? "failed" : "passed"),
    variants: [luna, opus, retired],
  })
  expect(snapshot.variants).toEqual([luna, opus])
})

test("does not test variants that can never be picked", async () => {
  const dominated = { ...opus, costPerTask: 20, intelligence: 50, model: "claude-old" }
  const tested: Variant[] = []
  await refreshFrontier({
    ...args,
    test: async variant => (tested.push(variant), "passed"),
    variants: [luna, opus, dominated],
  })
  expect(tested).not.toContainEqual(dominated)
})

test("keeps a harness's own best variant testable", async () => {
  const solMax: Variant = { ...luna, costPerTask: 20, intelligence: 50, model: "gpt-6.1-sol" }
  const tested: Variant[] = []
  await refreshFrontier({
    ...args,
    test: async variant => (tested.push(variant), "passed"),
    variants: [luna, opus, solMax],
  })
  expect(tested).toContainEqual(solMax)
})

test("skips variants that already passed", async () => {
  const tested: Variant[] = []
  await refreshFrontier({
    ...args,
    previous: {
      fetchedAt: "2026-11-01T00:00:00.000Z",
      floor: 9.7,
      indexVersion: 5,
      testedVariantKeys: ["codex/gpt-6-luna/low"],
      variants: [luna],
    },
    test: async variant => (tested.push(variant), "passed"),
    variants: [luna, opus],
  })
  expect(tested).toEqual([opus])
})

test("gives up without a snapshot when a usage limit interrupts testing", async () => {
  await expect(
    refreshFrontier({ ...args, test: async () => "limited", variants: [luna, opus] }),
  ).rejects.toThrow(/usage limit/i)
})
