#!/usr/bin/env -S node --experimental-strip-types

import { mkdir, realpath, unlink, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { parseArgs } from "node:util"
import { runWatchDaemon } from "./runWatchDaemon.ts"
import { isRunning } from "./isRunning.ts"
import { runWatchCommand } from "./runWatchCommand.ts"
import { readWatchJson, watchHome, watchPaths } from "./watchStorage.ts"
import type { DaemonReceipt, WatchConfig, WatchState } from "./types.ts"

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      repo: { type: "string" },
      thread: { type: "string" },
      "t3-home": { type: "string" },
      help: { type: "boolean" },
    },
  })
  const command = positionals[0] ?? "status"
  if (values.help || command === "help") {
    console.log(
      "watch-beads start --repo <path> --thread <existing-thread-id> [--t3-home <path>]\nwatch-beads status [--repo <path>]\nwatch-beads stop [--repo <path>] [--thread <expected-thread-id>]",
    )
  } else if (command === "_daemon") {
    await runWatchDaemon()
  } else {
    const repo = await realpath(values.repo ?? process.cwd())
    const paths = watchPaths(repo)
    const existing = await readWatchJson<WatchConfig>(paths.config)
    if (command === "start") {
      if (!values.thread) throw new Error("start requires --thread with an existing T3 thread ID")
      const t3Home = values["t3-home"] ?? process.env.T3CODE_HOME
      const config: WatchConfig = { repo, thread: values.thread, ...(t3Home ? { t3Home } : {}) }
      if (existing && JSON.stringify(existing) !== JSON.stringify(config)) {
        throw new Error(
          `Already watched by ${existing.thread}; coordinate with that owner, then stop it before changing recipients`,
        )
      }
      const target = JSON.parse(
        await runWatchCommand(
          "t3",
          [
            "--log-level",
            "error",
            "thread",
            "show",
            config.thread,
            "--json",
            ...(t3Home ? ["--base-dir", t3Home] : []),
          ],
          repo,
        ),
      )
      if (!target.thread || target.thread.archived)
        throw new Error("Recipient thread is unavailable or archived")
      await runWatchCommand("bd", ["config", "set", "events-journal", "true"], repo)
      if (!existing) {
        await mkdir(dirname(paths.config), { recursive: true, mode: 0o700 })
        await writeFile(paths.config, JSON.stringify(config, null, 2) + "\n", {
          flag: "wx",
          mode: 0o600,
        })
      }
      try {
        await runWatchCommand(
          "launchctl",
          ["kickstart", `gui/${process.getuid!()}/com.herbcaudill.watch-beads`],
          repo,
        )
      } catch {
        throw new Error(
          "Enrollment saved, but the managed watch-beads LaunchAgent is unavailable. Apply the dotfiles Nix configuration, then rerun start.",
        )
      }
      console.log(JSON.stringify({ registered: true, ...config, stateFile: paths.state }))
    } else if (command === "stop") {
      if (values.thread && existing && values.thread !== existing.thread)
        throw new Error("Recipient differs; refusing to stop another owner's watch")
      if (existing) await unlink(paths.config)
      console.log(JSON.stringify({ registered: false, repo }))
    } else if (command === "status") {
      const state = await readWatchJson<WatchState>(paths.state)
      const daemon = await readWatchJson<DaemonReceipt>(join(watchHome, "daemon.json"))
      console.log(
        JSON.stringify(
          {
            registered: Boolean(existing),
            config: existing,
            serviceRunning: Boolean(daemon && isRunning(daemon.pid, daemon.identity)),
            state,
            log: "/tmp/watch-beads.log",
          },
          null,
          2,
        ),
      )
    } else throw new Error(`Unknown command: ${command}`)
  }
} catch (error) {
  console.error(`[watch-beads] ${(error as Error).message}`)
  process.exitCode = 1
}
