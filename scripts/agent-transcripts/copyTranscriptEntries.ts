import { createReadStream, createWriteStream, existsSync, readFileSync, statSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { pipeline } from "node:stream/promises"
import { createGzip } from "node:zlib"
import { readTextTranscript } from "./readTextTranscript.ts"
import { getSessionSummary } from "../../home/.claude/skills/read-agent-sessions/scripts/get-session-summary.ts"
import type { TranscriptEntry } from "./types.ts"

/** Compress changed transcripts, preserve older sessions, and record their original metadata. */
export const copyTranscriptEntries = async (
  /** Working archive repository. */
  archiveRepositoryPath: string,
  /** Source files belonging to this machine. */
  transcriptEntries: TranscriptEntry[],
  /** Stable machine name. */
  machine: string,
  /** Maximum compressed bytes stored in one Git blob. */
  maxPartBytes = partBytes,
) => {
  const machineRoot = join(archiveRepositoryPath, "machines", machine)
  const manifestPath = join(machineRoot, "manifest.json")
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {}
  const files = previous.files ?? {}

  for (const entry of transcriptEntries) {
    const sourceStats = statSync(entry.absoluteSourcePath)
    const key = relative(
      machineRoot,
      join(archiveRepositoryPath, entry.archiveRelativePath),
    ).replaceAll("\\", "/")
    const existing = files[key]
    if (
      existing?.format === "readable-jsonl-v1" &&
      existing?.size === sourceStats.size &&
      existing?.modifiedAt === sourceStats.mtime.toISOString() &&
      existing.paths.every((path: string) => existsSync(join(machineRoot, path)))
    )
      continue

    const destination = join(machineRoot, `${key}.gz`)
    const temporary = `${destination}.tmp`
    const provider = key.startsWith("claude/projects/")
      ? "claude"
      : /^codex\/(sessions|archived_sessions)\//.test(key)
        ? "codex"
        : undefined
    await mkdir(dirname(destination), { recursive: true })
    await pipeline(
      readTextTranscript(entry.absoluteSourcePath, provider),
      createGzip(),
      createWriteStream(temporary),
    )
    const paths: string[] = []
    if (statSync(temporary).size <= maxPartBytes) {
      await rename(temporary, destination)
      paths.push(relative(machineRoot, destination).replaceAll("\\", "/"))
    } else {
      let index = 0
      for await (const chunk of createReadStream(temporary, { highWaterMark: maxPartBytes })) {
        const part = `${destination}.part-${String(index++).padStart(4, "0")}`
        await writeFile(`${part}.tmp`, chunk)
        await rename(`${part}.tmp`, part)
        paths.push(relative(machineRoot, part).replaceAll("\\", "/"))
      }
      await rm(temporary)
    }
    const summary = provider
      ? getSessionSummary({ provider, path: entry.absoluteSourcePath })
      : undefined
    files[key] = {
      format: "readable-jsonl-v1",
      size: sourceStats.size,
      modifiedAt: sourceStats.mtime.toISOString(),
      paths,
      summary: summary
        ? {
            id: summary.id,
            cwd: summary.cwd,
            createdAt: summary.createdAt,
            messages: summary.messages.filter(message => message.role === "user").slice(0, 1),
          }
        : undefined,
    }
    for (const obsolete of existing?.paths ?? []) {
      if (!paths.includes(obsolete)) await rm(join(machineRoot, obsolete), { force: true })
    }
  }

  await mkdir(machineRoot, { recursive: true })
  await writeFile(
    `${manifestPath}.tmp`,
    `${JSON.stringify({ machine, syncedAt: new Date().toISOString(), files }, null, 2)}\n`,
  )
  await rename(`${manifestPath}.tmp`, manifestPath)
  return Object.keys(files).length
}

/** Keep every Git blob comfortably below GitHub's file limit. */
const partBytes = 32 * 1024 * 1024
