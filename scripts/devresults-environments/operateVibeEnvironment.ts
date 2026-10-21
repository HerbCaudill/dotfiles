import { cp, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { operateNativeSource } from "./operateNativeSource.ts"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Manage only the explicitly paired VibeResults worktree and its limited scheduled worker. */
export async function operateVibeEnvironment(
  manifest: EnvironmentManifest,
  operation: "prepare" | "install" | "start" | "stop" | "status" | "preflight-remove" | "remove",
) {
  if (!manifest.vibe) return undefined
  if (operation !== "prepare") {
    try {
      await stat(`${manifest.vibe.path}.drenv-source/owner.json`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      try {
        await stat(manifest.vibe.path)
        throw new Error("VibeResults worktree has no ownership receipt")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      return { environmentId: manifest.id, ownerToken: manifest.ownerToken, status: "absent" }
    }
  }
  const sourceManifest = {
    ...manifest,
    requestedRevision: manifest.vibe.requestedRevision,
    paths: { ...manifest.paths, windows: manifest.vibe.path },
  }
  if (operation === "prepare") {
    for (const path of [
      ".cert/lego/certificates/viberesults.dev.crt",
      ".cert/lego/certificates/viberesults.dev.key",
      ".env.local",
    ])
      if (!(await stat(join(manifest.vibe.source, path))).isFile())
        throw new Error(`Missing VibeResults prerequisite: ${path}`)
    await operateNativeSource(sourceManifest, manifest.vibe.source)
    // Copy private inputs once; retries never overwrite later local edits or install shared modules.
    for (const name of [".cert", ".env.local"]) {
      try {
        await stat(join(manifest.vibe.path, name))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
        await cp(join(manifest.vibe.source, name), join(manifest.vibe.path, name), {
          recursive: true,
          dereference: true,
          errorOnExist: true,
          force: false,
        })
      }
    }
  }
  if (operation === "install") await operateNativeSource(sourceManifest)
  const [script, runner, job] = await Promise.all(
    ["vibe.ps1", "vibe-runner.ps1", "OwnedJob.cs"].map(name =>
      readFile(new URL(`./windows/${name}`, import.meta.url), "utf8"),
    ),
  )
  const result = await runWindowsAssetPayload(
    "& ([ScriptBlock]::Create($r.script)) -Request $r",
    { manifest, operation, script, runner, job },
    { host: manifest.windowsHost },
  )
  const response = JSON.parse(result.stdout.trim())
  if (!response.ok) throw new Error(response.error ?? "Owned VibeResults operation failed")
  if (response.environmentId !== manifest.id || response.ownerToken !== manifest.ownerToken)
    throw new Error("Foreign VibeResults response")
  return response
}
