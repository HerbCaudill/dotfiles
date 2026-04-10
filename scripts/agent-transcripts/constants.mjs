import { homedir } from "node:os"
import { join } from "node:path"

/** The managed archive repo path. */
export const AGENT_TRANSCRIPTS_REPO_PATH = join(homedir(), "Code/HerbCaudill/agent-transcripts")

/** The cron block label used in the user's crontab. */
export const CRON_BLOCK_NAME = "agent-transcripts"

/** The cron log file written by the managed sync job. */
export const CRON_LOG_PATH = "/tmp/agent-transcripts-sync.log"

/** The fixed raw transcript files that can be copied directly. */
export const FIXED_TRANSCRIPT_FILES = [
  {
    archiveRelativePath: "sources/claude/history.jsonl",
    sourceRelativePath: ".claude/history.jsonl",
  },
  {
    archiveRelativePath: "sources/codex/history.jsonl",
    sourceRelativePath: ".codex/history.jsonl",
  },
  {
    archiveRelativePath: "sources/codex/logs/logs_1.sqlite",
    sourceRelativePath: ".codex/logs_1.sqlite",
  },
  {
    archiveRelativePath: "sources/codex/logs/logs_1.sqlite-shm",
    sourceRelativePath: ".codex/logs_1.sqlite-shm",
  },
  {
    archiveRelativePath: "sources/codex/logs/logs_1.sqlite-wal",
    sourceRelativePath: ".codex/logs_1.sqlite-wal",
  },
  {
    archiveRelativePath: "sources/codex/state/state_5.sqlite",
    sourceRelativePath: ".codex/state_5.sqlite",
  },
  {
    archiveRelativePath: "sources/codex/state/state_5.sqlite-shm",
    sourceRelativePath: ".codex/state_5.sqlite-shm",
  },
  {
    archiveRelativePath: "sources/codex/state/state_5.sqlite-wal",
    sourceRelativePath: ".codex/state_5.sqlite-wal",
  },
]
