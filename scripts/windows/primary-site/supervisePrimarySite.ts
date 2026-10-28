import { spawn, type ChildProcess } from "node:child_process"
import { access, mkdir, open, writeFile } from "node:fs/promises"
import { get } from "node:http"
import { createServer } from "node:net"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

/** Start verified local storage before IIS, and supervise only the children started here. */
export async function supervisePrimarySite(
  /** Explicit installed executables and primary paths. */
  config: PrimarySiteConfig,
  /** Gracefully stop this owned process pair. */
  signal: AbortSignal,
  /** Emit operator-facing progress. */
  report: (message: string) => void = console.log,
) {
  await mkdir(config.logPath, { recursive: true })
  const children: { name: string; process: ChildProcess }[] = []
  const logs: Awaited<ReturnType<typeof open>>[] = []
  const pollMs = config.pollMs ?? 1000
  /** Persist the current dependency state for operators and task diagnostics. */
  async function status(state: string, message: string) {
    report(message)
    await writeFile(
      join(config.logPath, "status.json"),
      JSON.stringify(
        {
          state,
          message,
          at: new Date().toISOString(),
          pids: children.map(child => ({ name: child.name, pid: child.process.pid })),
        },
        null,
        2,
      ),
    )
  }
  /** Start a direct executable with durable output and no package manager or shell. */
  async function start(name: string, executable: string, args: string[]) {
    const log = await open(join(config.logPath, `${name}.log`), "a")
    logs.push(log)
    const process = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", log.fd, log.fd],
    })
    await new Promise<void>((resolve, reject) => {
      process.once("spawn", resolve)
      process.once("error", reject)
    })
    children.push({ name, process })
    return process
  }
  /** Refuse to report readiness when a directly owned child has exited. */
  function checkChildren() {
    for (const child of children)
      if (child.process.exitCode !== null || child.process.signalCode !== null)
        throw new Error(
          `${child.name} exited (${child.process.exitCode ?? child.process.signalCode}); see ${join(config.logPath, `${child.name}.log`)}`,
        )
  }
  try {
    await status("starting", "Verifying installed Azurite and primary ports")
    for (const port of [...config.ports, config.iisPort]) await requireFreePort(port)
    await access(config.dataPath)
    await access(config.app.executable)
    const executable = await selectInstalledAzurite(config.candidates, config.executableTimeoutMs)
    if (signal.aborted) return
    await start("Azurite", executable.node, [
      executable.entry,
      "--location",
      config.dataPath,
      "--debug",
      config.debugLogPath,
      "--blobHost",
      "127.0.0.1",
      "--queueHost",
      "127.0.0.1",
      "--tableHost",
      "127.0.0.1",
      "--blobPort",
      String(config.ports[0]),
      "--queuePort",
      String(config.ports[1]),
      "--tablePort",
      String(config.ports[2]),
    ])
    const deadline = Date.now() + (config.readinessTimeoutMs ?? 120000)
    while (!signal.aborted) {
      checkChildren()
      if (await storageReady(config.ports, executable.version)) break
      if (Date.now() >= deadline)
        throw new Error(
          `Storage readiness timed out on ${config.ports.join(", ")}; see ${join(config.logPath, "Azurite.log")}`,
        )
      await delay(pollMs)
    }
    if (signal.aborted) return
    checkChildren()
    await status("storage-ready", `Storage ready on ${config.ports.join(", ")}; starting IIS`)
    await start("IIS", config.app.executable, config.app.args)
    await status(
      "running",
      "IIS launched; storage supervision active (application HTTP health is separate)",
    )
    while (!signal.aborted) {
      await delay(pollMs)
      checkChildren()
      if (!(await storageReady(config.ports, executable.version)))
        throw new Error(`Storage health lost on ${config.ports.join(", ")}; stopping owned IIS`)
    }
    await status("stopped", "Primary startup stopped")
  } catch (error) {
    await status(
      "failed",
      `Primary dependency failure: ${error instanceof Error ? error.message : String(error)}`,
    )
    throw error
  } finally {
    for (const child of children.toReversed()) {
      if (child.process.exitCode !== null || child.process.signalCode !== null) continue
      const exited = new Promise<void>(resolve => child.process.once("exit", () => resolve()))
      child.process.kill()
      await Promise.race([exited, delay(3000)])
      if (child.process.exitCode === null && child.process.signalCode === null) {
        child.process.kill("SIGKILL")
        await exited
      }
    }
    for (const log of logs) await log.close()
  }
}

/** Select only explicit installed entrypoints whose real version command succeeds offline. */
export async function selectInstalledAzurite(
  /** Ordered operator-configured executable pairs; no cache discovery. */
  candidates: InstalledAzurite[],
  /** Bound cold Windows module loading without installing or resolving packages. */
  timeoutMs = 120000,
) {
  const failures: string[] = []
  for (const candidate of candidates) {
    try {
      await access(candidate.node)
      await access(candidate.entry)
      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(candidate.node, [candidate.entry, "--version"], {
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        })
        let output = ""
        child.stdout.on("data", data => {
          output = (output + data).slice(-4096)
        })
        child.stderr.on("data", () => {})
        const timeout = setTimeout(() => {
          child.kill()
          reject(new Error("version check timed out"))
        }, timeoutMs)
        child.once("error", error => {
          clearTimeout(timeout)
          reject(error)
        })
        child.once("exit", code => {
          clearTimeout(timeout)
          if (code === 0) resolve(output.trim())
          else reject(new Error(`version check exited ${code}`))
        })
      })
      if (output !== candidate.version)
        throw new Error(`expected ${candidate.version}, received ${output}`)
      return candidate
    } catch (error) {
      failures.push(`${candidate.entry}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(
    `No verified installed Azurite. Provision a complete installation separately and configure its Node/entry paths. ${failures.join("; ")}`,
  )
}

/** Verify all three configured endpoints identify the selected Azurite version. */
async function storageReady(ports: number[], version: string) {
  return (
    await Promise.all(
      ports.map(
        (port, index) =>
          new Promise<boolean>(resolve => {
            const request = get(
              { host: "127.0.0.1", port, path: "/devstoreaccount1", timeout: 500 },
              response => {
                response.resume()
                resolve(
                  response.statusCode === 400 &&
                    response.headers.server ===
                      `Azurite-${["Blob", "Queue", "Table"][index]}/${version}`,
                )
              },
            )
            request.on("timeout", () => request.destroy())
            request.on("error", () => resolve(false))
          }),
      ),
    )
  ).every(Boolean)
}

/** Refuse occupied ports rather than adopting or stopping another runtime. */
async function requireFreePort(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer()
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} already in use; leave the existing runtime intact and coordinate handoff`,
        ),
      ),
    )
    server.listen(port, "127.0.0.1", () =>
      server.close(error => (error ? reject(error) : resolve())),
    )
  })
}

/** An explicitly provisioned Node and Azurite installation. */
export type InstalledAzurite = { node: string; entry: string; version: string }

/** Inputs for one primary process pair; paths and ports never derive from another lane. */
export type PrimarySiteConfig = {
  candidates: InstalledAzurite[]
  dataPath: string
  debugLogPath: string
  logPath: string
  ports: [number, number, number]
  iisPort: number
  app: { executable: string; args: string[] }
  readinessTimeoutMs?: number
  executableTimeoutMs?: number
  pollMs?: number
}
