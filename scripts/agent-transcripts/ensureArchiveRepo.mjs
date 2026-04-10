import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { runCommand } from "./runCommand.mjs"

/** Ensure the archive repository exists and has its baseline files. */
export const ensureArchiveRepo = (
  /** The absolute path to the archive repository. */
  archiveRepositoryPath,
) => {
  mkdirSync(archiveRepositoryPath, { recursive: true })
  mkdirSync(join(archiveRepositoryPath, "sources"), { recursive: true })

  if (!existsSync(join(archiveRepositoryPath, ".git"))) {
    runCommand("git", ["init", "-b", "main"], { cwd: archiveRepositoryPath })
  }

  const gitignorePath = join(archiveRepositoryPath, ".gitignore")
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, ".DS_Store\n")
  }

  const readmePath = join(archiveRepositoryPath, "README.md")
  if (!existsSync(readmePath)) {
    writeFileSync(
      readmePath,
      [
        "# agent-transcripts",
        "",
        "Raw local transcript archive for Claude Code and Codex.",
        "",
        "Managed by `agent-transcripts-sync` from the dotfiles repo.",
        "",
        "## Sources",
        "",
        "- `sources/claude/history.jsonl`",
        "- `sources/claude/projects/**/*.jsonl`",
        "- `sources/codex/history.jsonl`",
        "- `sources/codex/state/*`",
        "- `sources/codex/logs/*`",
        "",
        "Codex transcript state is currently preserved as the raw local files Codex stores on disk, including SQLite databases and their sidecar files.",
        "",
      ].join("\n"),
    )
  }
}
