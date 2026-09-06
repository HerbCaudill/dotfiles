import { expect, test } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { acquirePrLock } from "../acquirePrLock.ts"

test("rejects a competing workflow and releases its owner lock after process exit", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-lock-"))
  const helper = new URL("../acquirePrLock.ts", import.meta.url).href
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `const { acquirePrLock } = await import(${JSON.stringify(helper)}); await acquirePrLock(process.argv[1]); process.stdout.write('ready'); setInterval(() => {}, 1000)`,
      root,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  )
  const exited = new Promise<void>(resolve => child.once("close", () => resolve()))
  try {
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("Lock child did not become ready")), 3000)
      child.stdout.once("data", () => {
        clearTimeout(deadline)
        resolve()
      })
      child.once("error", reject)
      child.once("exit", () => {
        clearTimeout(deadline)
        reject(new Error("Lock child exited early"))
      })
    })
    await expect(acquirePrLock(root)).rejects.toThrow("already running")
    child.kill("SIGKILL")
    await exited
    const release = await acquirePrLock(root)
    release()
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
    await exited
    await rm(root, { recursive: true, force: true })
  }
})
