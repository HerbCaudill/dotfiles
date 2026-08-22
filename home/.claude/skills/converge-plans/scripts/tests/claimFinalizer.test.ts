import { describe, expect, test } from "vitest"

import { claimFinalizer } from "../claimFinalizer.ts"
import type { ProtocolState } from "../types.ts"

describe("claimFinalizer", () => {
  test("grants the first claim and stops the other participant", () => {
    const result = claimFinalizer(state(), "claude", new Date("2026-01-01T00:00:00.000Z"))

    expect(result.won).toBe(true)
    expect(result.state.finalizer?.participant).toBe("claude")
    expect(result.state.participants.claude.status).toBe("finalizing")
    expect(result.state.participants.codex.status).toBe("stopped")
  })

  test("does not let a second participant take a live claim", () => {
    const claimed = claimFinalizer(state(), "claude", new Date("2026-01-01T00:00:00.000Z"))
    const result = claimFinalizer(claimed.state, "codex", new Date("2026-01-01T00:14:59.000Z"))

    expect(result.won).toBe(false)
    expect(result.state.finalizer?.participant).toBe("claude")
    expect(result.state.participants.codex.status).toBe("stopped")
  })

  test("recovers a stale claim after fifteen minutes", () => {
    const claimed = claimFinalizer(state(), "claude", new Date("2026-01-01T00:00:00.000Z"))
    const result = claimFinalizer(claimed.state, "codex", new Date("2026-01-01T00:15:00.000Z"))

    expect(result.won).toBe(true)
    expect(result.recovered).toBe(true)
    expect(result.state.finalizer?.participant).toBe("codex")
    expect(result.state.participants.claude.status).toBe("stopped")
  })
})

/** Build terminal protocol state with no finalizer. */
function state(): ProtocolState {
  return {
    version: 1,
    run: "014-detail-forms",
    planDirectory: "plans/014-detail-forms",
    branch: "plan-014",
    baseCommit: "abc123",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    participants: {
      claude: { status: "converged", updatedAt: "2026-01-01T00:00:00.000Z" },
      codex: { status: "converged", updatedAt: "2026-01-01T00:00:00.000Z" },
    },
    artifacts: {},
  }
}
