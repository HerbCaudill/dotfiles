#!/usr/bin/env -S node --experimental-strip-types

import { spawn } from "node:child_process"

/** Forward hourly inbox processing to the repository-owned entrypoint. */
async function processInbox(): Promise<void> {
  const child = spawn(
    process.execPath,
    [
      "--experimental-strip-types",
      "/Users/herbcaudill/Code/HerbCaudill/briefings/scripts/inbox/run.ts",
      ...process.argv.slice(2),
    ],
    { env: process.env, stdio: "inherit" },
  )
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code, signal) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(
            signal
              ? `Inbox processing stopped by ${signal}`
              : `Inbox processing exited with status ${code ?? "unknown"}`,
          ),
        )
    })
  })
}

await processInbox().catch(error => {
  console.error(`[inbox-processing] ${String(error)}`)
  process.exitCode = 1
})
