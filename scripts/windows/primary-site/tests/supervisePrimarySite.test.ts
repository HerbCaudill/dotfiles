import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "node:net"
import { afterEach, expect, test } from "vitest"
import {
  selectInstalledAzurite,
  supervisePrimarySite,
  type PrimarySiteConfig,
} from "../supervisePrimarySite.ts"

const controllers: AbortController[] = []
afterEach(() => controllers.splice(0).forEach(controller => controller.abort()))

/** Make a disposable, loopback-only startup fixture with no primary resources. */
async function fixture(mode = "healthy") {
  const root = await mkdtemp(join(tmpdir(), "primary-site-test-"))
  const ports = await Promise.all(
    [0, 1, 2, 3].map(
      () =>
        new Promise<number>(resolve => {
          const server = createServer().listen(0, "127.0.0.1", () => {
            const port = (server.address() as { port: number }).port
            server.close(() => resolve(port))
          })
        }),
    ),
  )
  const storage = join(root, "storage.mjs")
  const app = join(root, "app.mjs")
  const started = join(root, "app-started")
  await writeFile(
    storage,
    `import http from 'node:http';
if(process.argv.includes('--version')) { console.log('3.37.0'); process.exit(0); }
const ports = ${JSON.stringify(ports.slice(0, 3))};
if(${JSON.stringify(mode)} === 'exit') process.exit(7);
if(${JSON.stringify(mode)} !== 'unready') for (const [i, port] of ports.entries()) http.createServer((req,res) => {res.writeHead(400, {Server: 'Azurite-' + ['Blob','Queue','Table'][i] + '/3.37.0'});res.end();}).listen(port, '127.0.0.1');
if(${JSON.stringify(mode)} === 'late-exit') setTimeout(() => process.exit(8), 600);
setInterval(() => {}, 1000);
`,
  )
  await writeFile(
    app,
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(started)}, String(process.pid)); setInterval(() => {}, 1000);`,
  )
  const config: PrimarySiteConfig = {
    candidates: [{ node: process.execPath, entry: storage, version: "3.37.0" }],
    dataPath: root,
    debugLogPath: join(root, "debug.log"),
    logPath: root,
    ports: ports.slice(0, 3) as [number, number, number],
    iisPort: ports[3],
    app: { executable: process.execPath, args: [app] },
    readinessTimeoutMs: 500,
    pollMs: 40,
  }
  const controller = new AbortController()
  controllers.push(controller)
  const events: string[] = []
  return {
    config,
    controller,
    events,
    started,
    run: () => supervisePrimarySite(config, controller.signal, message => events.push(message)),
  }
}

test("starts IIS only after installed storage is ready, then stops its own children", async () => {
  const f = await fixture()
  const run = f.run()
  await expect.poll(async () => readFile(f.started, "utf8").catch(() => "")).not.toBe("")
  expect(f.events.some(message => message.includes("Storage ready"))).toBe(true)
  const pid = Number(await readFile(f.started, "utf8"))
  f.controller.abort()
  await run
  expect(() => process.kill(pid, 0)).toThrow()
})

test("reports unavailable installed candidates without starting IIS", async () => {
  const f = await fixture()
  f.config.candidates[0].entry += ".missing"
  await expect(f.run()).rejects.toThrow(/No verified installed Azurite/)
  await expect(readFile(f.started)).rejects.toThrow()
})

test("skips a broken installed candidate and verifies the next configured entry", async () => {
  const f = await fixture()
  const valid = f.config.candidates[0]
  await expect(selectInstalledAzurite([{ ...valid, version: "0.0.0" }, valid])).resolves.toEqual(
    valid,
  )
})

test("bounds a stalled executable verification", async () => {
  const f = await fixture()
  const entry = join(f.config.dataPath, "stalled.mjs")
  await writeFile(entry, "setInterval(() => {}, 1000)")
  await expect(selectInstalledAzurite([{ ...f.config.candidates[0], entry }], 100)).rejects.toThrow(
    /version check timed out/,
  )
})

test("IIS exit fails supervision and releases its owned storage ports", async () => {
  const f = await fixture()
  f.config.app.args = ["--eval", "process.exit(9)"]
  await expect(f.run()).rejects.toThrow(/IIS exited.*9/)
  for (const port of f.config.ports) {
    const server = createServer().listen(port, "127.0.0.1")
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve)
      server.once("error", reject)
    })
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test("reports storage exit before readiness and never starts IIS", async () => {
  const f = await fixture("exit")
  await expect(f.run()).rejects.toThrow(/Azurite exited.*7/)
  await expect(readFile(f.started)).rejects.toThrow()
})

test("bounds readiness failure and preserves diagnostic status", async () => {
  const f = await fixture("unready")
  await expect(f.run()).rejects.toThrow(/Storage readiness timed out/)
  expect(JSON.parse(await readFile(join(f.config.logPath, "status.json"), "utf8")).state).toBe(
    "failed",
  )
  await expect(readFile(f.started)).rejects.toThrow()
})

test("storage loss after readiness fails supervision and stops owned IIS", async () => {
  const f = await fixture("late-exit")
  await expect(f.run()).rejects.toThrow(/Azurite exited.*8/)
  const pid = Number(await readFile(f.started, "utf8"))
  expect(() => process.kill(pid, 0)).toThrow()
})

test("refuses an occupied port without adopting or stopping its listener", async () => {
  const f = await fixture()
  const listener = createServer().listen(f.config.ports[0], "127.0.0.1")
  await new Promise<void>(resolve => listener.once("listening", resolve))
  try {
    await expect(f.run()).rejects.toThrow(/already in use/)
    expect(listener.listening).toBe(true)
    await expect(readFile(f.started)).rejects.toThrow()
  } finally {
    listener.close()
  }
})
