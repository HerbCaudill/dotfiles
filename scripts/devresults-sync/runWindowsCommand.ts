import { spawn } from "node:child_process"

import { DEVRESULTS_HOST } from "./constants.ts"
import { encodePowerShellCommand } from "./encodePowerShellCommand.ts"

/** Run a PowerShell command on the DevResults Windows VM. */
export function runWindowsCommand(
  /** The PowerShell command text */
  command: string,
) {
  const encodedCommand = encodePowerShellCommand(command)
  const child = spawn(
    "ssh",
    [
      DEVRESULTS_HOST,
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodedCommand,
    ],
    { stdio: "inherit" },
  )

  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`drsync: ssh exited from signal ${signal}`)
      process.exit(1)
    }

    process.exit(code ?? 1)
  })

  child.on("error", error => {
    console.error(`drsync: ${error.message}`)
    process.exit(1)
  })
}
