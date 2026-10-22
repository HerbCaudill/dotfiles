import { spawn, execFile } from "node:child_process"
import { mkdir, open, rename } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs, promisify } from "node:util"
import { getRelease } from "./getRelease.ts"
import { prepareRelease } from "./prepareRelease.ts"
import { privateDirectory } from "./privateDirectory.ts"
import { waitForServiceLock } from "./waitForServiceLock.ts"
import { prepareWindowsCli } from "./prepareWindowsCli.ts"

/** Manage the mini's isolated Tasks release; enrollment never copies another machine's identity. */
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string", default: join(homedir(), "AppData/Local/Tasks") },
      space: { type: "string", default: "B7CSO2L6KYNN4HZBSBNHP3LC3SA7PYNJO" },
      repo: { type: "string" },
      revision: { type: "string" },
      help: { type: "boolean" },
    },
  })
  const root = values.root!
  const command = positionals[0]
  if (values.help || !command) {
    process.stdout.write(
      "tasks-agent <prepare|prepare-cli|select|release-path|enroll|serve|start|stop|status> [--repo path] [--revision full-sha]\nEnrollment consumes a one-time invitation from stdin. Automatic startup is enabled only after verification.\n",
    )
    return
  }
  if (command === "prepare") {
    if (!values.repo || !values.revision) throw new Error("prepare requires --repo and --revision")
    const prepared = await prepareRelease({
      repo: values.repo,
      revision: values.revision,
      root,
      pnpm: "pnpm",
    })
    await prepareWindowsCli(root, prepared)
    process.stdout.write(JSON.stringify(prepared) + "\n")
    return
  }
  const release = await getRelease(root, command === "select" ? values.revision : undefined)
  if (command === "prepare-cli") {
    process.stdout.write((await prepareWindowsCli(root, release)) + "\n")
    return
  }
  const stateDir = join(root, "agent")
  if (command === "select") {
    if (!values.revision) throw new Error("select requires --revision")
    await scheduled("stop")
    const lock = await waitForServiceLock({ release: release.path, stateDir })
    try {
      const temporary = join(root, "selected.pending.json")
      const file = await open(temporary, "w", 0o600)
      try {
        await file.writeFile(JSON.stringify({ revision: release.revision }))
        await file.sync()
      } finally {
        await file.close()
      }
      await rename(temporary, join(root, "selected.json"))
    } finally {
      lock.close()
    }
    process.stdout.write(JSON.stringify(release) + "\n")
  } else if (command === "release-path") process.stdout.write(release.path + "\n")
  else if (command === "status")
    process.stdout.write(
      JSON.stringify({ release: release.revision, spaceId: values.space }) + "\n",
    )
  else if (command === "start" || command === "stop") {
    await scheduled(command)
    if (command === "stop") (await waitForServiceLock({ release: release.path, stateDir })).close()
    process.stdout.write(JSON.stringify({ status: `${command}-requested` }) + "\n")
  } else if (command === "enroll" || command === "serve") {
    if (command === "enroll") await scheduled("stop")
    await mkdir(stateDir, { recursive: true, mode: 0o700 })
    await privateDirectory(stateDir)
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "src/agent/service/main.ts",
        "--state-dir",
        stateDir,
        "--space",
        values.space!,
        ...(command === "enroll" ? ["--enroll-stdin", "--enroll-and-exit"] : []),
      ],
      {
        cwd: release.path,
        stdio: "inherit",
        windowsHide: true,
      },
    )
    process.exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", code => resolve(code ?? 4))
    })
  } else throw new Error("Unknown operation; use --help")
}

/** Control only this machine's explicitly registered peer task. */
async function scheduled(
  /** Supervisor action, never an arbitrary PowerShell command. */
  action: "start" | "stop",
) {
  await promisify(execFile)(
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      action === "start"
        ? "Start-ScheduledTask -TaskName tasks-agent -ErrorAction Stop"
        : `& '${fileURLToPath(new URL("../windows/stop-tasks-agent.ps1", import.meta.url)).replaceAll("'", "''")}'`,
    ],
    { windowsHide: true },
  )
}

main().catch(() => {
  process.stderr.write(
    "Tasks agent operation failed; preserve storage and inspect installation or supervisor diagnostics.\n",
  )
  process.exitCode = 4
})
