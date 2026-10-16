import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { isAbsolute, join, relative, resolve } from "node:path"
import type { Provider, SessionFile } from "./types.ts"

/** Discover compressed transcripts from the local clone of the shared archive. */
export function findArchivedSessionFiles(
  /** Harness filter. */
  source: Provider | "all",
  /** Whether to include archived Codex sessions. */
  includeArchived: boolean,
  /** One archived machine or all machines. */
  machine: string,
): SessionFile[] {
  const root = join(
    process.env.AGENT_SESSIONS_ARCHIVE_ROOT ??
      join(homedir(), "Code/HerbCaudill/agent-transcripts"),
    "machines",
  )
  if (!existsSync(root))
    throw new Error(
      "Transcript archive is unavailable; clone HerbCaudill/agent-transcripts or use --machine local",
    )
  const machines = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
  if (machine !== "all" && !machines.includes(machine))
    throw new Error(`Unknown archive machine "${machine}"; available: ${machines.join(", ")}`)

  return machines
    .filter(name => machine === "all" || name === machine)
    .flatMap(name => {
      const machineRoot = join(root, name)
      const manifestPath = join(machineRoot, "manifest.json")
      if (!existsSync(manifestPath))
        throw new Error(
          `Missing archive manifest for ${name}; run agent-transcripts-sync on that machine`,
        )
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        files: Record<string, ArchiveEntry>
      }
      const archivedIds = new Set(
        Object.entries(manifest.files)
          .filter(([key]) => key.startsWith("codex/archived_sessions/"))
          .map(([, entry]) => entry.summary?.id),
      )

      return Object.entries(manifest.files).flatMap(([key, entry]) => {
        const provider = key.startsWith("claude/projects/")
          ? "claude"
          : /^codex\/(sessions|archived_sessions)\//.test(key)
            ? "codex"
            : undefined
        if (!provider || (source !== "all" && source !== provider)) return []
        if (!includeArchived && key.startsWith("codex/archived_sessions/")) return []
        if (
          key.startsWith("codex/sessions/") &&
          entry.summary?.id &&
          archivedIds.has(entry.summary.id)
        )
          return []
        const parts = entry.paths.map(path => {
          const absolute = resolve(machineRoot, path)
          const child = relative(machineRoot, absolute)
          if (
            isAbsolute(child) ||
            child === ".." ||
            child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
          )
            throw new Error("Archive fragment points outside its machine directory")
          return absolute
        })
        if (!parts.length || parts.some(path => !existsSync(path)))
          throw new Error(`Incomplete archive transcript on ${name}: ${key}`)
        return [
          {
            provider,
            path: parts[0],
            parts,
            machine: name,
            fileModifiedAt: new Date(entry.modifiedAt),
            summary: entry.summary,
          },
        ]
      })
    })
}

/** Reader-facing portion of one archive manifest entry. */
type ArchiveEntry = {
  /** Original source modification time. */
  modifiedAt: string
  /** Ordered compressed fragment paths, relative to the machine directory. */
  paths: string[]
  /** Cached user prompt and session metadata. */
  summary?: SessionFile["summary"]
}
