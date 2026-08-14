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
  fileModifiedAt: Date
  /** User-visible conversation events. */
  messages: SessionMessage[]
  /** Events omitted from a time-filtered result because they had no timestamp. */
  untimestampedMessagesOmitted?: number
}

/** Inclusive start and exclusive end for message filtering. */
export type TimeWindow = {
  /** Inclusive lower timestamp boundary. */
  since?: Date
  /** Exclusive upper timestamp boundary. */
  until?: Date
  /** Human-readable description for rendered output. */
  label: string
}

/** Parsed command-line options. */
export type CliOptions = {
  /** Requested operation. */
  command: "list" | "search" | "show" | "activity" | "help"
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
  /** Whether transcript headings include local event timestamps. */
  timestamps: boolean
  /** Output serialization format. */
  format: "markdown" | "json"
  /** Optional message-level time filter. */
  timeWindow?: TimeWindow
  /** Search query or session identifier. */
  value?: string
}
