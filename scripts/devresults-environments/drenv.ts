import { createEnvironmentLifecycle } from "./createEnvironmentLifecycle.ts"
import { getRegistryOptions } from "./getRegistryOptions.ts"
import { parseDrenvArgs } from "./parseDrenvArgs.ts"

try {
  const result = await createEnvironmentLifecycle(getRegistryOptions())(
    parseDrenvArgs(process.argv.slice(2)),
  )
  console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : "Environment operation failed")
  process.exitCode = 1
}
