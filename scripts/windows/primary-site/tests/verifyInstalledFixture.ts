import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import { supervisePrimarySite } from "../supervisePrimarySite.ts"

if (!process.argv[2] || !process.argv[3])
  throw new Error("Pass installed Node and Azurite entrypoint paths")
const root = await mkdtemp(join(tmpdir(), "primary-azurite-owned-fixture-"))
const ports: number[] = []
for (let index = 0; index < 4; index++) {
  const server = createServer().listen(0, "127.0.0.1")
  await new Promise<void>(resolve => server.once("listening", resolve))
  ports.push((server.address() as { port: number }).port)
  await new Promise<void>(resolve => server.close(() => resolve()))
}
const app = join(root, "fixture-app.mjs")
await writeFile(app, "setInterval(() => {}, 1000)")
const controller = new AbortController()
const events: string[] = []
const run = supervisePrimarySite(
  {
    candidates: [{ node: process.argv[2], entry: process.argv[3], version: "3.37.0" }],
    dataPath: root,
    debugLogPath: join(root, "debug.log"),
    logPath: root,
    ports: ports.slice(0, 3) as [number, number, number],
    iisPort: ports[3],
    app: { executable: process.argv[2], args: [app] },
    pollMs: 200,
  },
  controller.signal,
  message => {
    console.log(message)
    events.push(message)
  },
)
let failure: unknown
const settled = run.catch(error => {
  failure = error
})
try {
  const deadline = Date.now() + 250000
  while (
    !events.some(message => message.includes("supervision active")) &&
    !failure &&
    Date.now() < deadline
  )
    await delay(100)
  if (failure) throw failure
  assert.ok(
    events.some(message => message.includes("supervision active")),
    "real installed storage became ready",
  )
  const status = JSON.parse(await readFile(join(root, "status.json"), "utf8"))
  assert.equal(status.state, "running")
  console.log(JSON.stringify({ root, ports, pids: status.pids }))
  controller.abort()
  await settled
  for (const { pid } of status.pids)
    assert.throws(() => process.kill(pid, 0), "owned child stopped")
  console.log(
    "PASS: real installed Azurite readiness and owned process cleanup; diagnostics retained in fixture",
  )
} finally {
  controller.abort()
  await settled
}
