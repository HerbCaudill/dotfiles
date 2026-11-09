import { execFileSync } from "node:child_process"
import { parseArgs } from "node:util"
import { prepareForFeedback } from "./prepareForFeedback.ts"

const { values } = parseArgs({
  options: {
    environment: { type: "string", default: "compare-main" },
    instance: { type: "string", default: "loura" },
    "no-open": { type: "boolean", default: false },
  },
})

const isOnMini = process.platform === "win32"

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

const setup = prepareForFeedback(
  {
    mini: script =>
      isOnMini
        ? run("powershell.exe", powershellArgs(script))
        : run("ssh", ["mini", "powershell", ...powershellArgs(script)]),
    mac: script =>
      isOnMini ? run("ssh", ["mac", "/bin/bash", "-s"], script) : run("/bin/bash", ["-s"], script),
    wait: milliseconds =>
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds),
    log: message => console.log(message),
  },
  {
    environment: values.environment,
    instance: values.instance,
    open: !values["no-open"],
  },
)

console.log(JSON.stringify(setup, null, 2))
