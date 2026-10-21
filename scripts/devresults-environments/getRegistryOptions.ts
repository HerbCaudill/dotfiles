import { homedir } from "node:os"
import { join } from "node:path"
import type { RegistryOptions } from "./types.ts"

/** Canonical personal storage, independent of the current checkout and existing dr/drsync defaults. */
export function getRegistryOptions(
  /** Explicit target, independent of the caller's current directory. */
  host = process.env.DRENV_HOST ?? (process.platform === "win32" ? "mini" : "devresults-vm"),
  /** Native execution platform; injectable for host-profile checks. */
  platform: NodeJS.Platform = process.platform,
): RegistryOptions {
  if (!["mini", "devresults-vm"].includes(host)) throw new Error("Unknown Windows host profile")
  if (host === "mini")
    return {
      directory: "C:\\DevResultsEnvironments\\registry",
      windowsRoot: "C:\\DevResultsEnvironments",
      windowsHost: host,
      sourceMode: "native-windows",
      primarySource: "C:\\Code\\DevResults\\devresults",
      macRoot: "",
    }
  if (platform === "win32") throw new Error("Use the Mac for existing paired VM environments")
  return {
    directory: join(homedir(), ".local", "state", "drenv"),
    macRoot: join(homedir(), "Code", "DevResults", "environments"),
    windowsRoot: "C:\\DevResultsEnvironments",
    windowsHost: host,
  }
}
