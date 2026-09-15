import { homedir } from "node:os"
import { join } from "node:path"
import type { RegistryOptions } from "./types.ts"

/** Canonical personal storage, independent of the current checkout and existing dr/drsync defaults. */
export function getRegistryOptions(): RegistryOptions {
  return {
    directory: join(homedir(), ".local", "state", "drenv"),
    macRoot: join(homedir(), "Code", "DevResults", "environments"),
    windowsRoot: "C:\\DevResultsEnvironments",
    windowsHost: "devresults-vm",
  }
}
