/** Agent session CLI help text. */
export const usage = `Usage:
  agent-sessions.ts list [--source all|claude|codex] [--cwd PATH] [--limit N] [--archived]
  agent-sessions.ts search QUERY [--source all|claude|codex] [--cwd PATH] [--limit N] [--archived]
  agent-sessions.ts show ID_OR_PATH [--source all|claude|codex] [--tools]

List and search use active sessions by default. Add --archived to include archived Codex sessions.
Show resolves archived sessions automatically. Tool calls and results are omitted unless --tools is set.`
