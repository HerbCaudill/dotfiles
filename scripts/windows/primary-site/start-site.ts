import { readFile } from "node:fs/promises"
import { supervisePrimarySite, type PrimarySiteConfig } from "./supervisePrimarySite.ts"

const controller = new AbortController()
process.once("SIGINT", () => controller.abort())
process.once("SIGTERM", () => controller.abort())

try {
  if (!process.argv[2]) throw new Error("Usage: node start-site.ts <explicit-config.json>")
  const config: PrimarySiteConfig = JSON.parse(await readFile(process.argv[2], "utf8"))
  await supervisePrimarySite(config, controller.signal)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
