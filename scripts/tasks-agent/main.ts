import { execFile } from "node:child_process"
import { parseArgs, promisify } from "node:util"
import { join, resolve } from "node:path"
import { prepareRelease } from "./prepareRelease.ts"
import { getRelease } from "./getRelease.ts"
import { selectRelease } from "./selectRelease.ts"
import { waitForServiceLock } from "./waitForServiceLock.ts"
import { enrollAgent } from "./enrollAgent.ts"

/** Run one explicit service-management action with no automatic workflow activation. */
async function main() {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        root: { type: "string" },
        space: { type: "string" },
        pnpm: { type: "string", default: "pnpm" },
        repo: { type: "string" },
        revision: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    })

    if (values.help) process.stdout.write(HELP)
    else {
      if (!values.root || positionals.length !== 1)
        throw new Error("An explicit --root and one operation are required.")
      const root = resolve(values.root)
      const command = positionals[0]
      let result: unknown
      if (command === "prepare") {
        if (!values.repo || !values.revision)
          throw new Error("prepare requires --repo and --revision with a full reviewed commit SHA.")
        result = await prepareRelease({
          repo: values.repo,
          revision: values.revision,
          root,
          pnpm: values.pnpm,
        })
      } else if (command === "select") {
        if (!values.revision)
          throw new Error("select requires --revision with a prepared commit SHA.")
        result = await selectRelease({ root, revision: values.revision, stop: unload })
      } else if (command === "status") {
        const release = await getRelease(root).catch(() => undefined)
        result = {
          loaded: await loaded(),
          release: release?.revision ?? null,
          spaceId: values.space ?? null,
        }
      } else if (command === "release-path") {
        process.stdout.write((await getRelease(root)).path + "\n")
      } else if (command === "start") {
        await getRelease(root)
        if (!(await loaded()))
          await launchctl([
            "bootstrap",
            DOMAIN,
            join(process.env.HOME!, "Library/LaunchAgents/com.herbcaudill.tasks-agent.plist"),
          ])
        await launchctl(["kickstart", SERVICE])
        result = {
          status: "start-requested",
          message: "Use tasks status to verify the serving peer and space.",
        }
      } else if (command === "stop" || command === "enroll") {
        const release = await getRelease(root)
        await unload()
        const lock = await waitForServiceLock({
          release: release.path,
          stateDir: join(root, "agent"),
        })
        lock.close()
        if (command === "enroll") {
          if (!values.space) throw new Error("Enrollment requires the explicitly configured space.")
          result = await enrollAgent({
            release: release.path,
            stateDir: join(root, "agent"),
            spaceId: values.space,
          })
        } else result = { status: "stopped" }
      } else throw new Error("Unknown operation; use --help.")
      if (result !== undefined) process.stdout.write(JSON.stringify(result) + "\n")
    }
  } catch (error) {
    const message =
      error instanceof Error && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS")
        ? "Invalid Tasks agent options; use --help."
        : error instanceof Error
          ? error.message
          : "Tasks agent operation failed."
    process.stderr.write(`${message}\n`)
    process.exitCode = 4
  }
}

/** Query only supervisor existence, without printing its environment or task logs. */
async function loaded() {
  return launchctl(["print", SERVICE]).then(
    () => true,
    () => false,
  )
}

/** Disable automatic restarts before waiting for the service's ownership lock. */
async function unload() {
  if (await loaded()) await launchctl(["bootout", SERVICE])
}

/** Keep launchctl arguments literal and avoid printing supervisor environment details. */
async function launchctl(
  /** Arguments for this user's one managed job. */
  args: string[],
) {
  try {
    await promisify(execFile)("/bin/launchctl", args, { timeout: 15_000, maxBuffer: 1024 * 1024 })
  } catch {
    throw new Error("The user launchd operation failed; check the managed Tasks agent definition.")
  }
}

const DOMAIN = `gui/${process.getuid?.()}`
const SERVICE = `${DOMAIN}/com.herbcaudill.tasks-agent`
const HELP = `tasks-agent <prepare|select|start|stop|status|enroll> [options]

prepare --repo <Tasks checkout> --revision <full SHA>: install an isolated frozen source release; do not select it.
select --revision <prepared SHA>: unload launchd, await released ownership, then select that release; do not start it.
start: request launchd startup; verify actual peer readiness with tasks status.
stop: unload launchd and await the service ownership lock.
status: report selected release and supervisor presence; tasks status reports the actual peer.
enroll: read the one-time invitation only from stdin into a foreground service; stop after verified enrollment.

Managed wrappers supply --root, --space and --pnpm. Direct source use must provide --root.
No command edits existing capture, briefing, research or PR writers. The Mac must be awake.
Recovery preserves the bound peer directory and receipts. Never delete or replace them to silence startup errors.
`

await main()
