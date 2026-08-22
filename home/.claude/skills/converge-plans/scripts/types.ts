export type Participant = "claude" | "codex"

export type ParticipantStatus =
  | "active"
  | "waiting"
  | "converged"
  | "round-limit"
  | "blocked"
  | "finalizing"
  | "stopped"
  | "complete"

export type ProtocolState = {
  /** Protocol schema version. */
  version: 1
  /** Plan directory basename. */
  run: string
  /** Repository-relative numbered plan directory. */
  planDirectory: string
  /** Dedicated plan branch. */
  branch: string
  /** Main commit from which the plan branch was first created. */
  baseCommit: string
  /** ISO timestamp for run creation. */
  createdAt: string
  /** ISO timestamp for the latest protocol state change. */
  updatedAt: string
  /** Current state for both convergence participants. */
  participants: Record<Participant, ParticipantState>
  /** Immutable published artifacts keyed by repository-relative path. */
  artifacts: Record<string, PublishedArtifact>
  /** Current finalizer lease, when selection has occurred. */
  finalizer?: FinalizerClaim
  /** Commit on main that contains only the final plan. */
  finalCommit?: string
}

type ParticipantState = {
  /** Current protocol status. */
  status: ParticipantStatus
  /** ISO timestamp for the latest participant state change. */
  updatedAt: string
  /** Human-readable reason for blocked or stopped status. */
  reason?: string
}

export type PublishedArtifact = {
  /** Participant that published the artifact. */
  author: Participant
  /** Artifact role in the convergence exchange. */
  kind: "draft" | "response"
  /** One-based draft or response round. */
  sequence: number
  /** Repository-relative immutable artifact path. */
  path: string
  /** SHA-256 digest recorded at publication. */
  sha256: string
  /** ISO timestamp for publication. */
  publishedAt: string
  /** Response verdict, omitted for drafts. */
  verdict?: "revise" | "converged" | "round-limit"
}

export type ParsedArtifact = {
  /** Participant named by the artifact header. */
  author: Participant
  /** Artifact role parsed from the header. */
  kind: "draft" | "response"
  /** One-based round parsed from the header. */
  sequence: number
  /** Canonical destination filename. */
  filename: string
  /** Response verdict, omitted for drafts. */
  verdict?: "revise" | "converged" | "round-limit"
}

type FinalizerClaim = {
  /** Participant that owns finalization. */
  participant: Participant
  /** ISO timestamp for the original or recovered claim. */
  claimedAt: string
  /** ISO timestamp used to decide whether the claim is stale. */
  heartbeatAt: string
  /** Participant whose stale claim was recovered. */
  recoveredFrom?: Participant
}
