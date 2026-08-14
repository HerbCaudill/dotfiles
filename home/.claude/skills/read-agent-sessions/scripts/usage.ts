/** Agent session CLI help text. */
export const usage = `Usage:
  agent-sessions.ts list [--source all|claude|codex] [--cwd PATH] [--limit N] [--archived] [TIME]
  agent-sessions.ts search QUERY [--source all|claude|codex] [--cwd PATH] [--limit N] [--archived] [TIME]
  agent-sessions.ts show ID_OR_PATH [--source all|claude|codex] [--tools] [--timestamps] [TIME]
  agent-sessions.ts activity [--source all|claude|codex] [--cwd PATH] [--limit N] [--archived] [--tools] TIME

Time filters use the current environment's local timezone:
  --on today|yesterday|YYYY-MM-DD
  --since DATE_OR_DATETIME [--until DATE_OR_DATETIME]
  --until DATE_OR_DATETIME

Output options:
  --format markdown|json
  --timestamps

List and search use active sessions by default. Add --archived to include archived Codex sessions.
Show resolves archived sessions automatically. Tool calls and results are omitted unless --tools is set.`
