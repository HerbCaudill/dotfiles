import { parseClaudeSession } from "./parse-claude-session.ts"
import { parseCodexSession } from "./parse-codex-session.ts"
import type { SessionFile } from "./types.ts"

/** Normalize a transcript based on its discovered harness. */
export function parseSession(
  /** Discovered source file. */
  file: SessionFile,
  /** JSONL content. */
  text: string,
  /** Whether to retain tool traffic. */
  includeTools: boolean,
  /** Source file modification time. */
  fileModifiedAt: Date,
) {
  return file.provider === "claude"
    ? parseClaudeSession(file.path, text, includeTools, fileModifiedAt)
    : parseCodexSession(file.path, text, includeTools, fileModifiedAt)
}
