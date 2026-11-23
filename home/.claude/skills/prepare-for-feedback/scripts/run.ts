import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { prepareForFeedback } from "./prepareForFeedback.ts"

const { values } = parseArgs({
  options: {
    instance: { type: "string", default: "loura" },
    "no-open": { type: "boolean", default: false },
  },
})

if (process.platform !== "darwin") throw new Error("Run this on the Mac, which hosts the VM")

const run = (command: string, args: string[], input?: string) =>
  execFileSync(command, args, {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  })

// An encoded command survives both SSH and PowerShell quoting.
const powershellArgs = (script: string) => [
  "-NoProfile",
  "-EncodedCommand",
  Buffer.from(
    `$ProgressPreference = "SilentlyContinue"
${script}`,
    "utf16le",
  ).toString("base64"),
]

const devResults = join(homedir(), "Code", "DevResults")

const setup = prepareForFeedback(
  {
    vm: script =>
      run("ssh", [
        "-o",
        "ConnectTimeout=5",
        "devresults-vm",
        "powershell",
        ...powershellArgs(script),
      ]),
    mac: script => run("/bin/bash", ["-s"], script),
    wait: milliseconds =>
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds),
    log: message => console.log(message),
  },
  {
    instance: values.instance,
    open: !values["no-open"],
    repository: join(devResults, "devresults-next"),
    checkout: join(devResults, "devresults-next-feedback"),
  },
)

console.log(JSON.stringify(setup, null, 2))
