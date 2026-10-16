import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** Show each machine's last locally available snapshot without contacting the network. */
export function getArchiveStatus() {
  const root = join(
    process.env.AGENT_SESSIONS_ARCHIVE_ROOT ??
      join(homedir(), "Code/HerbCaudill/agent-transcripts"),
    "machines",
  )
  if (!existsSync(root))
    throw new Error("Transcript archive is unavailable; clone HerbCaudill/agent-transcripts first")
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const manifest = JSON.parse(readFileSync(join(root, entry.name, "manifest.json"), "utf8"))
      return {
        machine: entry.name,
        syncedAt: manifest.syncedAt as string,
        files: Object.keys(manifest.files).length,
      }
    })
}
