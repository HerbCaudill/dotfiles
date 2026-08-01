/** Agent harness that owns a session log. */
export type Provider = "claude" | "codex"

/** A discovered session log and its owning harness. */
export type SessionFile = {
  /** Harness that owns the log. */
  provider: Provider
  /** Absolute JSONL path. */
  path: string
}

/** A user-visible event normalized across harness log formats. */
export type SessionMessage = {
  /** Speaker or tool traffic category. */
  role: "user" | "assistant" | "tool"
  /** Plain-text event content. */
  text: string
  /** Source event timestamp, when available. */
  timestamp?: string
}

/** A normalized Claude or Codex session. */
export type Session = {
  /** Harness that owns the session. */
  provider: Provider
  /** Harness session identifier. */
  id: string
  /** Absolute source JSONL path. */
  path: string
  /** Working directory recorded by the harness. */
  cwd?: string
  /** Session creation timestamp, when available. */
  createdAt?: string
  /** Source file modification time. */
  updatedAt: Date
  /** User-visible conversation events. */
  messages: SessionMessage[]
}

/** Parsed command-line options. */
export type CliOptions = {
  /** Requested operation. */
  command: "list" | "search" | "show" | "help"
  /** Harness filter. */
  source: Provider | "all"
  /** Exact working-directory filter. */
  cwd?: string
  /** Maximum number of results. */
  limit: number
  /** Whether Codex archived sessions participate in list and search. */
  archived: boolean
  /** Whether transcript rendering includes tool traffic. */
  tools: boolean
  /** Search query or session identifier. */
  value?: string
}
