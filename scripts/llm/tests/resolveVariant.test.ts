import { expect, test } from "vitest"
import { resolveVariant } from "../resolveVariant.ts"
import type { Snapshot, Variant } from "../types.ts"

const lunaLow = variant("codex", "gpt-6-luna", "low", 9.7, 0.005)
const terraLow = variant("codex", "gpt-6.1-terra", "low", 29.2, 0.071)
const solMax = variant("codex", "gpt-6.1-sol", "max", 54.5, 1.272)
const opusXhigh = variant("claude", "claude-opus-5-5", "xhigh", 57, 6.047)
const opusMax = variant("claude", "claude-opus-5-5", "max", 58.4, 10.036)
const snapshot = createSnapshot([lunaLow, terraLow, solMax, opusXhigh, opusMax])

test("maps 0 to the floor and 100 to the top score", () => {
  expect(resolveVariant(snapshot, { level: 0 })).toEqual(lunaLow)
  expect(resolveVariant(snapshot, { level: 100 })).toEqual(opusMax)
})

test("picks the cheapest variant that reaches the target", () => {
  expect(resolveVariant(snapshot, { level: 25 })).toEqual(terraLow)
  expect(resolveVariant(snapshot, { level: 95 })).toEqual(opusXhigh)
})

test("ignores cheaper models below the floor", () => {
  const weak = variant("codex", "gpt-tiny", "low", 3, 0.001)
  expect(resolveVariant(createSnapshot([weak, ...snapshot.variants]), { level: 0 })).toEqual(
    lunaLow,
  )
})

test("uses a pinned harness's best variant when it cannot reach the target", () => {
  expect(resolveVariant(snapshot, { harness: "codex", level: 100 })).toEqual(solMax)
})

test("skips excluded harnesses", () => {
  expect(resolveVariant(snapshot, { excludedHarnesses: ["claude"], level: 100 })).toEqual(solMax)
})

test("throws when no variant is available", () => {
  expect(() =>
    resolveVariant(snapshot, { excludedHarnesses: ["claude", "codex"], level: 50 }),
  ).toThrow(/no model/i)
})

test("rejects levels outside 0 to 100", () => {
  expect(() => resolveVariant(snapshot, { level: 101 })).toThrow(/0 and 100/)
})

/** Create a variant for a test. */
function variant(
  /** Harness name. */
  harness: string,
  /** Model ID. */
  model: string,
  /** Effort level. */
  effort: Variant["effort"],
  /** Intelligence score. */
  intelligence: number,
  /** Cost per task. */
  costPerTask: number,
): Variant {
  return { costPerTask, effort, harness, intelligence, model }
}

/** Create a snapshot with today's floor. */
function createSnapshot(
  /** Variants in the snapshot. */
  variants: Variant[],
): Snapshot {
  return { fetchedAt: "2026-11-01T00:00:00.000Z", floor: 9.7, indexVersion: 5, variants }
}
