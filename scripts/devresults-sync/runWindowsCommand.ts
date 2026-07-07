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
      "-OutputFormat",
      "Text",
      "-EncodedCommand",
      encodedCommand,
    ],
    { stdio: "inherit" },
  )

  return new Promise<number>((resolve, reject) => {
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`ssh exited from signal ${signal}`))
        return
      }

      resolve(code ?? 1)
    })

    child.on("error", error => {
      reject(error)
    })
  })
}

/** Run a PowerShell command on the DevResults Windows VM and exit if it fails. */
export async function runWindowsCommandOrExit(
  /** The PowerShell command text */
  command: string,
) {
  try {
    const code = await runWindowsCommand(command)

    if (code !== 0) process.exit(code)
  } catch (error) {
    console.error(`drsync: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
