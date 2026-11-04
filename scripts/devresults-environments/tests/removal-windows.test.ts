import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"
import { runDrenvCommand } from "../runDrenvCommand.ts"

it.skipIf(process.platform !== "win32")(
  "retries watcher and VibeResults cleanup after worktrees disappear while preserving ownership checks",
  async () => {
    const result = await runDrenvCommand({
      executable: `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        fileURLToPath(new URL("../windows/partial-remove.tests.ps1", import.meta.url)),
        "-ScriptPath",
        fileURLToPath(new URL("../windows/vibe.ps1", import.meta.url)),
      ],
    })
    expect(JSON.parse(result.stdout)).toEqual({ passed: 16 })
  },
)

it.skipIf(process.platform !== "win32")(
  "removes clean legacy source with long dependencies and preserves external junction targets",
  async () => {
    const result = await runDrenvCommand({
      executable: `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-File",
        fileURLToPath(new URL("../windows/remove-source.tests.ps1", import.meta.url)),
        "-ScriptPath",
        fileURLToPath(new URL("../windows/lifecycle.ps1", import.meta.url)),
        "-ProvisionPath",
        fileURLToPath(new URL("../windows/provision.ps1", import.meta.url)),
      ],
    })
    expect(JSON.parse(result.stdout)).toEqual({
      worktreeRemoved: true,
      controlRemoved: true,
      foreignPreserved: true,
    })
  },
)
