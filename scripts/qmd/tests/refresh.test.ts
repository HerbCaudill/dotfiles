import { test } from "node:test"
import assert from "node:assert/strict"
import { acquireRefreshLock, refreshBudget } from "../refresh.ts"
import { once } from "node:events"

test("mini refresh defers during the briefing window and stops before 06:00", () => {
  assert.equal(refreshBudget(new Date(2026, 9, 30, 7), true), 0)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 6), true), 0)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 8, 59), true), 0)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 5, 30), true), 30 * 60_000)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 23), true), 7 * 3600_000)
  assert.equal(refreshBudget(new Date(2026, 9, 30, 9), true), 20 * 3600_000)
})

test("refresh excludes a second worker and releases the lock on close", async () => {
  const first = await acquireRefreshLock(0)
  assert.ok(first)
  const address = first.address()
  assert.ok(address && typeof address !== "string")
  assert.equal(await acquireRefreshLock(address.port), null)
  first.close()
  await once(first, "close")
  const next = await acquireRefreshLock(address.port)
  assert.ok(next)
  next.close()
  await once(next, "close")
})
