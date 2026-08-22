import type { Participant, ProtocolState } from "./types.ts"

/** Atomically decide whether a participant owns finalization. */
export function claimFinalizer(
  /** Current protocol state. */
  state: ProtocolState,
  /** Participant attempting to claim finalization. */
  participant: Participant,
  /** Current time used for the finalizer lease. */
  now: Date,
) {
  const next = structuredClone(state)
  const current = next.finalizer
  if (!current) assertTerminal(state)
  const recovered = Boolean(
    current &&
    current.participant !== participant &&
    now.getTime() - new Date(current.heartbeatAt).getTime() >= STALE_CLAIM_MILLISECONDS,
  )

  if (current && current.participant !== participant && !recovered) {
    return { recovered: false, state: next, won: false }
  }

  const timestamp = now.toISOString()
  const previousParticipant = recovered ? current?.participant : undefined
  next.finalizer = {
    participant,
    claimedAt: recovered || !current ? timestamp : current.claimedAt,
    heartbeatAt: timestamp,
    ...(previousParticipant ? { recoveredFrom: previousParticipant } : {}),
  }
  next.updatedAt = timestamp
  next.participants[participant] = { status: "finalizing", updatedAt: timestamp }

  const loser: Participant = participant === "claude" ? "codex" : "claude"
  next.participants[loser] = {
    status: "stopped",
    updatedAt: timestamp,
    reason: recovered
      ? `Finalizer claim recovered by ${participant}`
      : `${participant} claimed finalization`,
  }

  return { recovered, state: next, won: true }
}

/** Require both participants to have reached a terminal convergence state. */
function assertTerminal(state: ProtocolState) {
  const terminal = new Set(["converged", "round-limit"])
  if (
    !terminal.has(state.participants.claude.status) ||
    !terminal.has(state.participants.codex.status)
  ) {
    throw new Error("Both participants must finish convergence before finalization")
  }
}

const STALE_CLAIM_MILLISECONDS = 15 * 60 * 1000
