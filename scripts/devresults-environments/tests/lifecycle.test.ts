import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { createEnvironmentLifecycle } from "../createEnvironmentLifecycle.ts"

it("resumes failed creation with durable inputs and stops before syncing/building", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-lifecycle-")))
  const calls: string[] = []
  let fail = true
  const options = {
    directory,
    macRoot: join(directory, "mac"),
    windowsRoot: "C:\\DrenvTest",
    windowsHost: "devresults-vm",
  }
  const adapters = {
    inventory: async () => ({ windowsPorts: [], macPorts: [] }),
    pair: async (_m: unknown, source: string) => {
      calls.push(`pair:${source}`)
      return "a".repeat(40)
    },
    sync: async () => {
      calls.push("sync")
      return "b".repeat(40)
    },
    provision: async () => {
      calls.push("provision")
      if (fail) throw new Error("snapshot capacity")
    },
    refresh: async () => {
      calls.push("refresh")
    },
    windows: async (_m: unknown, operation: string) => {
      calls.push(operation)
      return { status: operation === "start" ? "running" : "stopped" }
    },
  }
  try {
    const lifecycle = createEnvironmentLifecycle(options, adapters)
    await expect(
      lifecycle({
        command: "create",
        id: "proof",
        source: "/Users/test/source",
        snapshot: "/Users/test/snapshot.json",
      }),
    ).rejects.toThrow("snapshot capacity")
    fail = false
    await lifecycle({ command: "create", id: "proof" })
    expect(calls.filter(c => c.startsWith("pair:"))).toEqual([
      "pair:/Users/test/source",
      "pair:/Users/test/source",
    ])
    calls.length = 0
    await lifecycle({ command: "sync", id: "proof" })
    expect(calls).toEqual(["stop", "sync", "build", "refresh", "schema"])
    await expect(
      lifecycle({ command: "create", id: "proof", source: "/different" }),
    ).rejects.toThrow("creation inputs")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it("does not mark a failed start running or a failed removal removed", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-lifecycle-")))
  const options = {
    directory,
    macRoot: join(directory, "mac"),
    windowsRoot: "C:\\DrenvTest",
    windowsHost: "devresults-vm",
  }
  const lifecycle = createEnvironmentLifecycle(options, {
    inventory: async () => ({ windowsPorts: [], macPorts: [] }),
    pair: async () => "a".repeat(40),
    provision: async () => {},
    windows: async (_m, operation) => {
      if (operation === "start" || operation === "remove") throw new Error("foreign owner")
      return { status: "stopped" }
    },
    refresh: async () => {},
  })
  try {
    await lifecycle({
      command: "create",
      id: "proof",
      source: "/Users/test/source",
      snapshot: "/Users/test/snapshot.json",
    })
    await expect(lifecycle({ command: "start", id: "proof" })).rejects.toThrow("foreign owner")
    await expect(lifecycle({ command: "remove", id: "proof" })).rejects.toThrow("foreign owner")
    expect(((await lifecycle({ command: "status" })) as { phase: string }[])[0].phase).toBe(
      "failed",
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it("explicit recovery refuses a live lock owner and removes only a dead unchanged receipt", async () => {
  const { mkdir, writeFile, access } = await import("node:fs/promises")
  const { recoverEnvironmentLock } = await import("../recoverEnvironmentLock.ts")
  const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-recover-")))
  const lock = join(directory, "registry.lock")
  try {
    await mkdir(lock)
    await writeFile(
      join(lock, "owner.json"),
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    )
    await expect(recoverEnvironmentLock(directory)).rejects.toThrow("still alive")
    await writeFile(
      join(lock, "owner.json"),
      JSON.stringify({ pid: 999_999_999, createdAt: new Date().toISOString() }),
    )
    await recoverEnvironmentLock(directory)
    await expect(access(lock)).rejects.toThrow()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
