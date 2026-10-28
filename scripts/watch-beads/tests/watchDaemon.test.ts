import { afterEach, expect, it } from "vitest"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const cli = fileURLToPath(new URL("../watch-beads.ts", import.meta.url))
const processes: ChildProcess[] = []
let directory: string

afterEach(async () => {
  for (const child of processes) {
    if (child.exitCode !== null || child.signalCode) continue
    const exited = new Promise(resolve => child.once("exit", resolve))
    child.kill("SIGTERM")
    await exited
  }
  if (directory) await rm(directory, { recursive: true, force: true })
})

it("debounces event wakes, preserves delivery state across restart, protects owners and stops cleanly", async () => {
  directory = await mkdtemp(join(tmpdir(), "watch-beads-test-"))
  const bin = join(directory, "bin")
  await mkdir(bin)
  const fixture = join(directory, "board.json")
  const deliveries = join(directory, "deliveries.jsonl")
  const environment = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    WATCH_BEADS_HOME: join(directory, "state"),
    WATCH_BEADS_FIXTURE: fixture,
    WATCH_BEADS_DELIVERIES: deliveries,
  }
  const shim = `#!${process.execPath}\nimport ${JSON.stringify(new URL("./fixtures/fakeCli.ts", import.meta.url).href)}\n`
  for (const executable of ["bd", "t3", "launchctl"])
    await writeFile(join(bin, executable), shim, { mode: 0o755 })
  let sequence = 0
  const update = async (ready: object[], active: object[] = []) => {
    await writeFile(fixture, JSON.stringify({ ready, active, sequence: ++sequence }))
  }
  await update([
    { id: "epic", issue_type: "epic" },
    { id: "human", labels: ["human"] },
    { id: "owned", assignee: "agent" },
  ])
  const messages = async () => {
    try {
      return (await readFile(deliveries, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(line => JSON.parse(line))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }
  }
  const command = (args: string[]) =>
    new Promise<{ code: number | null; output: string }>(resolve => {
      const child = spawn(process.execPath, [cli, ...args], { env: environment })
      processes.push(child)
      let output = ""
      child.stdout.on("data", chunk => {
        output += chunk
      })
      child.stderr.on("data", chunk => {
        output += chunk
      })
      child.on("close", code => resolve({ code, output }))
    })
  const daemon = () => {
    const child = spawn(process.execPath, [cli, "_daemon"], { env: environment, stdio: "ignore" })
    processes.push(child)
    return child
  }
  let service = daemon()
  expect((await command(["start", "--repo", directory, "--thread", "owner-thread"])).code).toBe(0)
  const rejected = await command(["start", "--repo", directory, "--thread", "duplicate-thread"])
  expect(rejected.code).toBe(1)
  expect(rejected.output).toContain("Already watched by owner-thread")
  await eventually(async () => {
    const result = await command(["status", "--repo", directory])
    expect(JSON.parse(result.output).state.lastCheck).toBeTruthy()
  })
  expect(await messages()).toEqual([])
  await update([{ id: "task-a" }])
  await delay(100)
  await update([{ id: "task-a" }, { id: "task-b" }])
  await eventually(async () => expect(await messages()).toHaveLength(1))
  expect((await messages())[0]).toMatchObject({ thread: "owner-thread" })
  expect((await messages())[0].message).toContain('["task-a","task-b"]')
  // Duplicate event hints and process restarts must not repeatedly wake unchanged work.
  await update([{ id: "task-a" }, { id: "task-b" }])
  await delay(2000)
  expect(await messages()).toHaveLength(1)
  const exited = new Promise(resolve => service.once("exit", resolve))
  service.kill("SIGTERM")
  await exited
  service = daemon()
  await delay(2500)
  expect(await messages()).toHaveLength(1)
  // A completion releases capacity for work still waiting in the ready queue.
  await update([{ id: "task-a" }, { id: "task-b" }], [{ id: "active" }])
  await delay(2000)
  await update([{ id: "task-a" }, { id: "task-b" }])
  await eventually(async () => expect(await messages()).toHaveLength(2))
  expect((await command(["stop", "--repo", directory, "--thread", "wrong-owner"])).code).toBe(1)
  expect((await command(["stop", "--repo", directory, "--thread", "owner-thread"])).code).toBe(0)
  await delay(2500)
  await update([{ id: "new-after-stop" }])
  await delay(2000)
  expect(await messages()).toHaveLength(2)
}, 30_000)

/** Retry asynchronous process assertions until their bounded deadline. */
async function eventually(
  /** Observable assertion expected after background processing. */
  assertion: () => Promise<void>,
) {
  const deadline = Date.now() + 7000
  while (true) {
    try {
      await assertion()
      return
    } catch (error) {
      if (Date.now() > deadline) throw error
      await delay(100)
    }
  }
}
