import { homedir } from "node:os"
import { join } from "node:path"

/** Claude project session root, overridable for tests and alternate installs. */
export const claudeSessionsRoot =
  process.env.AGENT_SESSIONS_CLAUDE_ROOT ?? join(homedir(), ".claude", "projects")

/** Active Codex rollout root, overridable for tests and alternate installs. */
export const codexSessionsRoot =
  process.env.AGENT_SESSIONS_CODEX_ROOT ?? join(homedir(), ".codex", "sessions")

/** Archived Codex rollout root, overridable for tests and alternate installs. */
export const codexArchivedSessionsRoot =
  process.env.AGENT_SESSIONS_CODEX_ARCHIVED_ROOT ?? join(homedir(), ".codex", "archived_sessions")

/** Maximum bytes read while deriving list metadata. */
export const summaryReadBytes = 1024 * 1024
