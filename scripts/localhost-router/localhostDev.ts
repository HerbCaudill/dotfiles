import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { assertManagedProxy } from "./assertManagedProxy.ts"
import { getLaunchSettings } from "./getLaunchSettings.ts"

const stateDir = join(homedir(), ".portless")
const args = process.argv.slice(2)
const portless = process.env.LOCALHOST_DEV_PORTLESS
if (!portless) throw new Error("Use the localhost-dev executable installed by dotfiles.")
const env = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== "PORTLESS" && !key.startsWith("PORTLESS_"),
    ),
  ),
  PORTLESS_STATE_DIR: stateDir,
  PORTLESS_PORT: "443",
  PORTLESS_HTTPS: "1",
  PORTLESS_LAN: "0",
  PORTLESS_SYNC_HOSTS: "0",
  PORTLESS_WILDCARD: "0",
  PORTLESS_TLD: "localhost",
}
try {
  if (args[0] === "url") {
    console.log(getLaunchSettings(process.cwd(), [...args.slice(1), "url"]).url)
  } else if (args[0] === "recover") {
    const modulePath = process.env.LOCALHOST_DEV_PORTLESS_MODULE
    if (!modulePath) throw new Error("The managed Portless module is unavailable")
    const { RouteStore } = await import(pathToFileURL(modulePath).href)
    const removed = new RouteStore(stateDir).pruneStaleRoutes()
    console.log(`Removed ${removed.length} stale registration(s). No app processes were stopped.`)
  } else {
    await assertManagedProxy(stateDir)
    const settings = ["routes", "doctor"].includes(args[0])
      ? { command: [args[0] === "routes" ? "list" : "doctor"] }
      : (() => {
          const launch = getLaunchSettings(process.cwd(), args)
          return { command: ["--name", launch.name, ...launch.command] }
        })()
    // Portless owns the app tree; isolate it so terminal signals are forwarded only once.
    const child = spawn(portless, settings.command, { env, stdio: "inherit", detached: true })
    let stopping = false
    /** Forward a terminal signal once and let Portless finish removing its registration. */
    const stop = (
      /** Signal received by this launcher. */
      signal: NodeJS.Signals,
    ) => {
      if (stopping) return
      stopping = true
      child.kill(signal)
    }
    process.on("SIGINT", () => stop("SIGINT"))
    process.on("SIGTERM", () => stop("SIGTERM"))
    child.on("error", error => {
      console.error(error.message)
      process.exitCode = 1
    })
    child.on("exit", code => {
      process.exitCode = code ?? (stopping ? 0 : 1)
    })
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
