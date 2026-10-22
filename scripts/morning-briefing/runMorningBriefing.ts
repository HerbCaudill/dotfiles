#!/usr/bin/env -S node --experimental-strip-types

import { spawn } from "node:child_process"
import { getBriefingInvocation } from "./getBriefingInvocation.ts"

/** Forward the installed command to the repository-owned morning briefing pipeline. */
async function runMorningBriefing(): Promise<void> {
  const invocation = getBriefingInvocation(process.argv.slice(2))
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", invocation.entrypoint, ...invocation.arguments],
    {
      env: process.env,
      stdio: "inherit",
    },
  )

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
