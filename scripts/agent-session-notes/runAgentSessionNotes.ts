import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { findArchivedSessionFiles } from "../../home/.claude/skills/read-agent-sessions/scripts/find-archived-session-files.ts"
import { parseSession } from "../../home/.claude/skills/read-agent-sessions/scripts/parse-session.ts"
import { readTranscriptFile } from "../../home/.claude/skills/read-agent-sessions/scripts/read-transcript-file.ts"
import type { Session } from "../../home/.claude/skills/read-agent-sessions/scripts/types.ts"
import { isMainModule } from "../isMainModule.ts"
import { planSessionNotes } from "./planSessionNotes.ts"
import type { ExistingNote } from "./planSessionNotes.ts"

/** Export finished human-driven sessions from the shared archive into the notes vault. */
function main() {
  const dryRun = process.argv.includes("--dry-run")
  const notesDir =
    process.env.AGENT_SESSION_NOTES_VAULT ?? join(homedir(), "Code/HerbCaudill/notes")
  const sessionsDir = join(notesDir, "sessions")
  mkdirSync(sessionsDir, { recursive: true })

  const sessions = readArchivedSessions()
  const existing = readExistingNotes(sessionsDir)
  const { writes, withheld } = planSessionNotes(sessions, existing, new Date())

  // Obsidian Sync owns the mini's vault, so the job only writes files and never touches Git.
  if (!dryRun) {
    for (const { fileName, content } of writes) writeFileSync(join(sessionsDir, fileName), content)
  }

  for (const { machine, sessionId, kinds } of withheld)
    log(`Withheld ${machine}/${sessionId}: ${kinds.join(", ")}`)
  log(
    `${sessions.length} sessions read, ${existing.length} notes existed, ${writes.length} ${dryRun ? "would change" : "changed"}, ${withheld.length} withheld`,
  )
}

/** Read every session in the archive, skipping subagent logs before the cost of parsing them. */
function readArchivedSessions(): Session[] {
  return findArchivedSessionFiles("all", true, "all")
    .filter(file => !/[\\/]subagents[\\/]/.test(file.parts?.[0] ?? file.path))
    .map(file =>
      parseSession(file, readTranscriptFile(file), false, file.fileModifiedAt ?? new Date(0)),
    )
}

/** Read the notes already in the vault, identified by their frontmatter. */
function readExistingNotes(
  /** Vault folder holding session notes. */
  sessionsDir: string,
): ExistingNote[] {
  return readdirSync(sessionsDir)
    .filter(fileName => fileName.endsWith(".md"))
    .flatMap(fileName => {
      const content = readFileSync(join(sessionsDir, fileName), "utf8")
      const machine = content.match(/^machine: (.+)$/m)?.[1]
      const sessionId = content.match(/^session_id: (.+)$/m)?.[1]
      return machine && sessionId ? [{ machine, sessionId, fileName, content }] : []
    })
}

/** Log with a timestamp. */
function log(
  /** Message to log. */
  message: string,
) {
  console.log(`${new Date().toISOString()} ${message}`)
}

// Runs last so the imports above are initialized before main reads them.
if (isMainModule(import.meta.url)) {
  try {
    main()
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
