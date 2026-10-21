import { spawn } from "node:child_process"
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout } from "node:timers/promises"
import { getRegistryOptions } from "./getRegistryOptions.ts"
import { createEnvironmentLifecycle } from "./createEnvironmentLifecycle.ts"
import { parseDrenvArgs } from "./parseDrenvArgs.ts"

const options = getRegistryOptions("mini")
if (process.env.COMPUTERNAME?.toLowerCase() !== "mini")
  throw new Error("The mini controller must run on mini")
const directory = join(options.directory, "requests")
await mkdir(directory, { recursive: true })
const id = process.argv[2]
if (id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid controller request")
  const path = join(directory, id)
  const request = JSON.parse(await readFile(join(path, "request.json"), "utf8"))
  let result
  try {
    const args = parseDrenvArgs(request.args)
    if (args.host && args.host !== "mini") throw new Error("Foreign host in native request")
    result = { ok: true, value: await createEnvironmentLifecycle(options)(args) }
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : "Native operation failed",
    }
  }
  await writeFile(join(path, "result.tmp"), JSON.stringify(result))
  await rename(join(path, "result.tmp"), join(path, "result.json"))
} else {
  // One expensive operation at a time bounds RAM use; status queries remain available during builds.
  const running = new Map<string, { pid: number; expensive: boolean }>()
  let heartbeat = 0
  for (;;) {
    if (Date.now() - heartbeat > 5000) {
      const path = join(options.directory, "controller-state.json")
      await writeFile(
        `${path}.tmp`,
        JSON.stringify({ pid: process.pid, updatedAt: new Date().toISOString() }),
      )
      await rename(`${path}.tmp`, path)
      heartbeat = Date.now()
    }
    for (const name of await readdir(directory)) {
      if (!/^[a-f0-9-]{36}$/.test(name) || running.has(name)) continue
      const path = join(directory, name)
      try {
        await readFile(join(path, "result.json"))
        continue
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      let request
      try {
        request = JSON.parse(await readFile(join(path, "request.json"), "utf8"))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
        throw error
      }
      // Never replay an interrupted mutation automatically, including after a host reboot.
      try {
        const previous = JSON.parse(await readFile(join(path, "worker.json"), "utf8"))
        let alive = true
        try {
          process.kill(previous.pid, 0)
        } catch {
          alive = false
        }
        if (alive) continue
        await writeFile(
          join(path, "result.tmp"),
          JSON.stringify({
            ok: false,
            error:
              "Controller worker was interrupted. Inspect status and recover the owned environment before retrying.",
          }),
        )
        await rename(join(path, "result.tmp"), join(path, "result.json"))
        continue
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      let args
      try {
        args = parseDrenvArgs(request.args)
      } catch {
        await writeFile(
          join(path, "result.tmp"),
          JSON.stringify({ ok: false, error: "Invalid native command arguments" }),
        )
        await rename(join(path, "result.tmp"), join(path, "result.json"))
        continue
      }
      const expensive = !["status", "url", "help"].includes(args.command)
      if (expensive && [...running.values()].some(worker => worker.expensive)) continue
      if (running.size >= 8) continue
      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", fileURLToPath(import.meta.url), name],
        { stdio: "ignore", windowsHide: true },
      )
      if (!child.pid) throw new Error("Controller worker did not launch")
      running.set(name, { pid: child.pid, expensive })
      await writeFile(
        join(path, "worker.json"),
        JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }),
        { flag: "wx" },
      )
      child.on("exit", () => running.delete(name))
    }
    await setTimeout(500)
  }
}
