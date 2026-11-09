import { join } from "node:path"

/** The global agent instructions, whose model roles table is the source of truth for roles. */
export const INSTRUCTIONS_PATH = join(import.meta.dirname, "../../home/.claude/AGENTS.md")

/** Time limit for a run unless the caller sets one. */
export const DEFAULT_TIMEOUT_MS = 45 * 60 * 1_000
