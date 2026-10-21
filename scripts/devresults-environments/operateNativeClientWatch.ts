import { readFile, stat } from "node:fs/promises"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Supervise a limited native client watcher separately from the legacy IIS Job. */
export async function operateNativeClientWatch(
  manifest: EnvironmentManifest,
  operation: "start" | "stop" | "status" | "remove",
) {
  if (!manifest.sourceMode) return undefined
  if (operation !== "start") {
    try {
      await stat(`${manifest.paths.windows}.drenv-source/owner.json`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "absent" }
      throw error
    }
  }
  const [script, runner, job, watch, publish] = await Promise.all(
    [
      "windows/vibe.ps1",
      "windows/vibe-runner.ps1",
      "windows/OwnedJob.cs",
      "nativeClientWatch.ts",
      "publishClientBuild.ts",
    ].map(name => readFile(new URL(name, import.meta.url), "utf8")),
  )
  const result = await runWindowsAssetPayload(
    "& ([ScriptBlock]::Create($r.script)) -Request $r",
    {
      manifest,
      operation: operation === "remove" ? "remove-task" : operation,
      script,
      runner,
      job,
      watch,
      publish,
      clientWatch: true,
    },
    { host: manifest.windowsHost },
  )
  const response = JSON.parse(result.stdout.trim())
  if (!response.ok) throw new Error(response.error ?? "Owned client watcher operation failed")
  if (response.environmentId !== manifest.id || response.ownerToken !== manifest.ownerToken)
    throw new Error("Foreign client watcher result")
  return response
}
