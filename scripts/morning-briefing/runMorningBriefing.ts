#!/usr/bin/env -S node --experimental-strip-types

import { spawn } from "node:child_process"

const REPOSITORY_ENTRYPOINT =
  "/Users/herbcaudill/Code/HerbCaudill/briefings/scripts/morning-briefing/run.ts"

/** Forward the installed command to the repository-owned morning briefing pipeline. */
async function runMorningBriefing(): Promise<void> {
  const child = spawn(REPOSITORY_ENTRYPOINT, process.argv.slice(2), {
    env: process.env,
    stdio: "inherit",
  })

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          signal
            ? `Morning briefing stopped by ${signal}`
            : `Morning briefing exited with status ${code ?? "unknown"}`,
        ),
      )
    })
  })
}

await runMorningBriefing().catch(error => {
  console.error(`[morning-briefing] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
