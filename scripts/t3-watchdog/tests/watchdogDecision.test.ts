import { describe, expect, it } from "vitest"

import { watchdogDecision, type WatchdogState } from "../watchdogDecision.ts"

const NOW = Date.parse("2026-11-19T15:00:00Z")
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString()
const healthy: WatchdogState = { restarts: [] }

describe("watchdogDecision", () => {
  it("stays quiet while T3 answers", () => {
    const decision = watchdogDecision({
      now: NOW,
      probeOk: true,
      state: healthy,
      maintenanceRestarting: false,
    })
    expect(decision).toEqual({ action: "none", state: healthy })
  })

  it("notes the first failed probe without restarting", () => {
    const decision = watchdogDecision({
      now: NOW,
      probeOk: false,
      state: healthy,
      maintenanceRestarting: false,
    })
    expect(decision.action).toBe("none")
    expect(decision.state.failingSince).toBe(minutesAgo(0))
    expect(decision.message).toMatch(/not answering/)
  })

  it("waits while T3 has been unresponsive for under five minutes", () => {
    const state = { restarts: [], failingSince: minutesAgo(3) }
    const decision = watchdogDecision({
      now: NOW,
      probeOk: false,
      state,
      maintenanceRestarting: false,
    })
    expect(decision.action).toBe("none")
  })

  it("restarts T3 after five minutes without an answer", () => {
    const state = { restarts: [], failingSince: minutesAgo(5) }
    const decision = watchdogDecision({
      now: NOW,
      probeOk: false,
      state,
      maintenanceRestarting: false,
    })
    expect(decision.action).toBe("restart")
    expect(decision.state).toEqual({ restarts: [minutesAgo(0)] })
  })

  it("leaves T3 alone while the maintenance restart is under way", () => {
    const state = { restarts: [], failingSince: minutesAgo(10) }
    const decision = watchdogDecision({
      now: NOW,
      probeOk: false,
      state,
      maintenanceRestarting: true,
    })
    expect(decision.action).toBe("none")
  })

  it("gives up once, after three restarts in three hours haven't helped", () => {
    const state = {
      restarts: [minutesAgo(150), minutesAgo(90), minutesAgo(30)],
      failingSince: minutesAgo(6),
    }
    const first = watchdogDecision({
      now: NOW,
      probeOk: false,
      state,
      maintenanceRestarting: false,
    })
    expect(first.action).toBe("give-up")
    const second = watchdogDecision({
      now: NOW + 60_000,
      probeOk: false,
      state: first.state,
      maintenanceRestarting: false,
    })
    expect(second.action).toBe("none")
  })

  it("forgets restarts older than three hours", () => {
    const state = {
      restarts: [minutesAgo(400), minutesAgo(300), minutesAgo(200)],
      failingSince: minutesAgo(6),
    }
    const decision = watchdogDecision({
      now: NOW,
      probeOk: false,
      state,
      maintenanceRestarting: false,
    })
    expect(decision.action).toBe("restart")
    expect(decision.state.restarts).toEqual([minutesAgo(0)])
  })

  it("reports recovery and starts restarting again after giving up", () => {
    const state = {
      restarts: [minutesAgo(100), minutesAgo(60), minutesAgo(20)],
      failingSince: minutesAgo(10),
      gaveUpAt: minutesAgo(4),
    }
    const decision = watchdogDecision({
      now: NOW,
      probeOk: true,
      state,
      maintenanceRestarting: false,
    })
    expect(decision.action).toBe("none")
    expect(decision.message).toMatch(/answering again after 10 min/)
    expect(decision.state).toEqual({ restarts: state.restarts })
  })
})
