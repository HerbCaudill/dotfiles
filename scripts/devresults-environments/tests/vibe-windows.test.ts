import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"
import { runDrenvCommand } from "../runDrenvCommand.ts"

it.skipIf(process.platform !== "win32")(
  "repairs dependencies on explicit install while preparation reuses its receipt",
  async () => {
    const result = await runDrenvCommand({
      executable: `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        fileURLToPath(new URL("../windows/vibe.tests.ps1", import.meta.url)),
        "-ScriptPath",
        fileURLToPath(new URL("../windows/vibe.ps1", import.meta.url)),
      ],
    })
    expect(JSON.parse(result.stdout)).toEqual([
      { operation: "prepare", status: "installed", launches: 0 },
      { operation: "install", status: "installed", launches: 1 },
    ])
  },
)
