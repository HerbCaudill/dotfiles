import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** Check whether a module is the process entry point, following filesystem symlinks. */
export function isMainModule(
  /** `import.meta.url` from the calling module. */
  moduleUrl: string,
  /** Entry-point path reported by Node. */
  entryPointPath: string | undefined = process.argv[1],
): boolean {
  if (!entryPointPath) return false

  try {
    return realpathSync(entryPointPath) === realpathSync(fileURLToPath(moduleUrl))
  } catch {
    return false
  }
}
