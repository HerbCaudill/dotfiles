import { test } from "node:test"
import assert from "node:assert/strict"
import { refreshBudget } from "../refresh.ts"

test("mini refresh defers during the briefing window and stops before 06:00", () => {
  assert.equal(refreshBudget(new Date(2026, 9, 30, 7), true), 0)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 6), true), 0)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 8, 59), true), 0)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 5, 30), true), 30 * 60_000)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 23), true), 7 * 3600_000)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 9), true), 20 * 3600_000)
})
