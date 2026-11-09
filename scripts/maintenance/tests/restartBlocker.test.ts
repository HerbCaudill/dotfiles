import { describe, expect, it } from "vitest"

import { restartBlocker } from "../restartBlocker.ts"

describe("restartBlocker", () => {
  it("waits until the mini has been up for most of three days", () => {
    expect(restartBlocker({ uptimeHours: 38, sessions: [] })).toMatch(/uptime/)
  })

  it("restarts after about three days with only a disconnected session", () => {
    const sessions = [{ user: "herb", state: "Disc" as const, idleMinutes: 5 }]
    expect(restartBlocker({ uptimeHours: 62, sessions })).toBeNull()
  })

  it("does not restart while someone is actively using the desktop", () => {
    const sessions = [{ user: "herb", state: "Active" as const, idleMinutes: 3 }]
    expect(restartBlocker({ uptimeHours: 62, sessions })).toMatch(/herb/)
  })

  it("restarts when an active desktop session has been idle for a while", () => {
    const sessions = [{ user: "herb", state: "Active" as const, idleMinutes: 90 }]
    expect(restartBlocker({ uptimeHours: 62, sessions })).toBeNull()
  })
})
