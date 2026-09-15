import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { createRegistry } from "./createRegistry.ts"
import { withEnvironmentLock } from "./withEnvironmentLock.ts"
import { pairEnvironmentSource } from "./pairEnvironmentSource.ts"
import { syncEnvironmentSource } from "./syncEnvironmentSource.ts"
import { provisionWindowsEnvironment } from "./provisionWindowsEnvironment.ts"
import { refreshWindowsDeployment } from "./refreshWindowsDeployment.ts"
import { runWindowsLifecycle } from "./runWindowsLifecycle.ts"
import { inventoryEnvironmentResources } from "./inventoryEnvironmentResources.ts"
import { recoverEnvironmentLock } from "./recoverEnvironmentLock.ts"
import {
  removeMacEnvironmentSource,
  preflightMacEnvironmentSource,
} from "./removeMacEnvironmentSource.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import type { DrenvArgs, EnvironmentManifest, RegistryOptions, ResourceInventory } from "./types.ts"

/** Compose the complete identity-explicit command under durable operation locks. */
export function createEnvironmentLifecycle(
  /** Personal registry and native roots. */
  options: RegistryOptions,
  /** Boundary adapters used by behavioral tests. */
  adapters: Adapters = {},
) {
  const registry = createRegistry(options)
  const remote = adapters.windows ?? runWindowsLifecycle
  /** Execute one public command without inferring a destination from the current directory. */
  return async (args: DrenvArgs): Promise<unknown> => {
    if (args.command === "help")
      return "drenv create <id> [--source <Mac checkout>] [--revision <ref>] [--preset inl] [--snapshot <receipt.json>]\ndrenv sync|start|status|url|open|stop|snapshot|reset|remove|recover <id>\nCommit paired Mac edits before sync. Creation requires a coordinated SQL/blob snapshot. Reset restores the original creation snapshot."
    if (args.command === "status" && !args.id) return registry.list()
    if (!args.id) throw new Error("An environment ID is required")
    if (args.command === "recover") {
      await recoverEnvironmentLock(options.directory)
      const manifest = await registry.get(args.id)
      await remote(manifest, "recover")
      await recoverEnvironmentLock(join(options.directory, "operations", args.id))
      return {
        environmentId: manifest.id,
        status: "recovered",
        next: "Retry the original command; Windows resources were checked and stopped",
      }
    }
    return withEnvironmentLock(options.directory, args.id, async () => {
      let manifest: EnvironmentManifest | undefined
      try {
        if (args.command === "create") {
          const intent = await creationIntent(options.directory, args)
          manifest = await registry.reserve({
            id: args.id!,
            preset: intent.preset,
            revision: intent.revision,
            database: intent.database,
            instance: intent.instance,
            inventory: await (adapters.inventory ?? inventoryEnvironmentResources)(options),
          })
          if (manifest.phase === "running")
            throw new Error("Stop the environment before resuming creation")
          const revision = await (adapters.pair ?? pairEnvironmentSource)(manifest, intent.source)
          manifest = await registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "source-ready",
            completedStep: "source-paired",
            revision,
          })
          if (!intent.snapshot)
            throw new Error(
              "Supply --snapshot with a coordinated SQL/blob receipt to resume this creation",
            )
          // Preflight useful-data capacity before installing dependencies or producing build output.
          if (!adapters.provision)
            await provisionWindowsEnvironment(manifest, {
              snapshot: intent.snapshot,
              operation: "verify",
            })
          await remote(manifest, "build")
          await (
            adapters.provision ??
            (async (m, snapshot) => {
              await provisionWindowsEnvironment(m, { snapshot })
            })
          )(manifest, intent.snapshot)
          await remote(manifest, "schema")
          return registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "provisioned",
            completedStep: "schema-verified",
          })
        }
        manifest = await registry.get(args.id!)
        if (args.command === "url" || args.command === "open") {
          const url = `https://${manifest.data.instance}.devlocal.us:${manifest.ports.https}`
          if (args.command === "open")
            await runDrenvCommand({ executable: "open", args: ["-a", "Google Chrome", url] })
          return url
        }
        if (args.command === "status")
          return { ...manifest, live: await remote(manifest, "status") }
        if (manifest.phase === "removed")
          throw new Error("This environment was removed; choose a new ID")
        if (args.command === "stop") {
          await remote(manifest, "stop")
          return registry.checkpoint(manifest.id, manifest.ownerToken, { phase: "stopped" })
        }
        if (args.command === "start") {
          const result = await remote(manifest, "start")
          if (result.status !== "running")
            throw new Error("Supervisor did not verify all owned runtime processes")
          return registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "running",
            completedStep: "runtime-started",
          })
        }
        if (args.command === "remove")
          await (adapters.preflightMac ?? preflightMacEnvironmentSource)(manifest)
        await remote(manifest, "stop")
        manifest = await registry.checkpoint(manifest.id, manifest.ownerToken, { phase: "stopped" })
        if (args.command === "sync") {
          const revision = await (adapters.sync ?? syncEnvironmentSource)(manifest)
          manifest = await registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "source-ready",
            revision,
            completedStep: "source-synced",
          })
          await remote(manifest, "build")
          await (adapters.refresh ?? refreshWindowsDeployment)(manifest)
          await remote(manifest, "schema")
          return registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "provisioned",
            completedStep: "schema-verified",
          })
        }
        if (args.command === "snapshot") {
          const result = await remote(manifest, "snapshot")
          const directory = join(options.directory, "snapshots", manifest.id)
          await mkdir(directory, { recursive: true })
          const path = join(directory, `${Date.now()}.json`)
          await writeFile(path, JSON.stringify(result.snapshot, null, 2) + "\n", {
            flag: "wx",
            mode: 0o600,
          })
          return { snapshot: path, phase: "stopped" }
        }
        if (args.command === "reset") {
          const intent = await creationIntent(options.directory, {
            command: "create",
            id: manifest.id,
          })
          if (!intent.snapshot)
            throw new Error("The original coordinated creation snapshot is required for reset")
          // Verify the original immutable snapshot before dropping any owned data.
          if (!adapters.provision)
            await provisionWindowsEnvironment(manifest, {
              snapshot: intent.snapshot,
              operation: "verify",
            })
          await remote(manifest, "reset")
          await (
            adapters.provision ??
            (async (m, snapshot) => {
              await provisionWindowsEnvironment(m, { snapshot })
            })
          )(manifest, intent.snapshot)
          await remote(manifest, "schema")
          return registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "provisioned",
            completedStep: "reset",
          })
        }
        if (args.command === "remove") {
          await remote(manifest, "remove")
          await (adapters.removeMac ?? removeMacEnvironmentSource)(manifest)
          return registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "removed",
            completedStep: "removed",
          })
        }
        throw new Error("Unsupported lifecycle operation")
      } catch (error) {
        if (
          manifest &&
          manifest.phase !== "removed" &&
          !["status", "url", "open"].includes(args.command)
        )
          await registry.checkpoint(manifest.id, manifest.ownerToken, {
            phase: "failed",
            failure: `Operation ${args.command} failed; inspect owned receipts before retry`,
          })
        throw error
      }
    })
  }
}

/** Save creation selections before side effects, allowing a missing snapshot to be supplied on retry. */
async function creationIntent(
  /** Private registry directory. */
  directory: string,
  /** Explicit create options; omitted retry options retain their prior values. */
  args: DrenvArgs,
): Promise<Intent> {
  const parent = join(directory, "intents")
  await mkdir(parent, { recursive: true })
  const path = join(parent, `${args.id}.json`)
  let saved: Intent | undefined
  try {
    saved = JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const next = { ...saved }
  for (const key of ["source", "snapshot", "revision", "preset", "database", "instance"] as const) {
    if (args[key] === undefined) continue
    if (saved?.[key] !== undefined && saved[key] !== args[key])
      throw new Error("Retry creation inputs differ from the saved selection")
    Object.assign(next, { [key]: args[key] })
  }
  const intent: Intent = { source: join(homedir(), "Code", "DevResults", "DevResults"), ...next }
  const temporary = `${path}.tmp`
  await writeFile(temporary, JSON.stringify(intent), { mode: 0o600 })
  await rename(temporary, path)
  return intent
}

/** Immutable human creation choices, independent of later source sync. */
type Intent = Pick<DrenvArgs, "snapshot" | "revision" | "preset" | "database" | "instance"> & {
  source: string
}
/** Host boundaries that can be substituted without mocking registry semantics. */
type Adapters = {
  /** Fresh listener and binding inventory. */
  inventory?: (options: RegistryOptions) => Promise<ResourceInventory>
  /** Native source pairing. */
  pair?: (manifest: EnvironmentManifest, source: string) => Promise<string>
  /** Explicit committed source sync. */
  sync?: (manifest: EnvironmentManifest) => Promise<string>
  /** Useful data provisioning. */
  provision?: (manifest: EnvironmentManifest, snapshot: string) => Promise<unknown>
  /** Fresh deployment copy. */
  refresh?: (manifest: EnvironmentManifest) => Promise<unknown>
  /** Windows supervisor and resource lifecycle. */
  windows?: (
    manifest: EnvironmentManifest,
    operation: string,
  ) => Promise<{ status: string; snapshot?: unknown }>
  /** Read-only local source ownership and cleanliness guard before remote deletion. */
  preflightMac?: (manifest: EnvironmentManifest) => Promise<unknown>
  /** Verified local source cleanup. */
  removeMac?: (manifest: EnvironmentManifest) => Promise<unknown>
}
