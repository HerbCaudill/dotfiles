import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { parseDrenvArgs } from "../parseDrenvArgs.ts"
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

it("refuses dirty Mac source before any Windows removal", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-remove-")))
  const calls: string[] = []
  const lifecycle = createEnvironmentLifecycle(
    {
      directory,
      macRoot: join(directory, "mac"),
      windowsRoot: "C:\\DrenvTest",
      windowsHost: "devresults-vm",
    },
    {
      inventory: async () => ({ windowsPorts: [], macPorts: [] }),
      pair: async () => "a".repeat(40),
      provision: async () => {},
      windows: async (_m, operation) => {
        calls.push(operation)
        return { status: "stopped" }
      },
      preflightMac: async () => {
        throw new Error("Mac source has uncommitted work")
      },
      removeMac: async () => {
        calls.push("removeMac")
      },
    },
  )
  try {
    await lifecycle({
      command: "create",
      id: "proof",
      source: "/Users/test/source",
      snapshot: "/Users/test/snapshot.json",
    })
    calls.length = 0
    await expect(lifecycle({ command: "remove", id: "proof" })).rejects.toThrow("uncommitted")
    expect(calls).toEqual([])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it.each(["stop", "recover", "reset", "remove"] as const)(
  "%s preserves data when the Windows launch is queued",
  async command => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-queued-")))
    let queued = false
    const mutations: string[] = []
    const lifecycle = createEnvironmentLifecycle(
      {
        directory,
        macRoot: join(directory, "mac"),
        windowsRoot: "C:\\DrenvTest",
        windowsHost: "devresults-vm",
      },
      {
        inventory: async () => ({ windowsPorts: [], macPorts: [] }),
        pair: async () => "a".repeat(40),
        preflightMac: async () => {},
        removeMac: async () => {
          mutations.push("Mac removal")
        },
        provision: async () => {
          mutations.push("provision")
        },
        windows: async () => {
          if (queued) throw new Error("Owned task is queued")
          return { status: "stopped" }
        },
      },
    )
    try {
      await lifecycle({
        command: "create",
        id: "proof",
        source: "/Users/test/source",
        snapshot: "/Users/test/snapshot.json",
      })
      mutations.length = 0
      queued = true
      await expect(lifecycle({ command, id: "proof" })).rejects.toThrow("queued")
      expect(mutations).toEqual([])
      const entries = (await lifecycle({ command: "status" })) as { phase: string }[]
      expect(entries[0].phase).not.toBe("removed")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)

it("preserves partial Mac pairing when removal has no verified revision", async () => {
  const { mkdir, writeFile, access } = await import("node:fs/promises")
  const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-unpaired-")))
  const calls: string[] = []
  let claim = ""
  const lifecycle = createEnvironmentLifecycle(
    {
      directory,
      macRoot: join(directory, "mac"),
      windowsRoot: "C:\\DrenvTest",
      windowsHost: "devresults-vm",
    },
    {
      inventory: async () => ({ windowsPorts: [], macPorts: [] }),
      pair: async manifest => {
        claim = `${manifest.paths.mac}.drenv-source`
        await mkdir(claim, { recursive: true })
        await writeFile(
          join(claim, "owner.json"),
          JSON.stringify({
            environmentId: manifest.id,
            ownerToken: manifest.ownerToken,
            path: manifest.paths.mac,
          }),
        )
        throw new Error("interrupted pairing")
      },
      windows: async (_manifest, operation) => {
        calls.push(operation)
        return { status: "removed" }
      },
    },
  )
  try {
    await expect(lifecycle({ command: "create", id: "partial" })).rejects.toThrow(
      "interrupted pairing",
    )
    await expect(lifecycle({ command: "remove", id: "partial" })).rejects.toThrow(
      "without a verified source revision",
    )
    await expect(access(join(claim, "owner.json"))).resolves.toBeUndefined()
    expect(calls).toEqual([])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it("runs explicit owned database refresh and leaves the environment stopped", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-refresh-")))
  const calls: string[] = []
  const lifecycle = createEnvironmentLifecycle(
    {
      directory,
      macRoot: join(directory, "mac"),
      windowsRoot: "C:\\DrenvTest",
      windowsHost: "devresults-vm",
    },
    {
      inventory: async () => ({ windowsPorts: [], macPorts: [] }),
      pair: async () => "a".repeat(40),
      provision: async () => {},
      windows: async (_m, operation) => {
        calls.push(operation)
        return { status: operation === "refresh-db" ? "schema-verified" : "stopped" }
      },
    },
  )
  try {
    await lifecycle({ command: "create", id: "proof", snapshot: "/snapshot.json" })
    expect(calls).not.toContain("refresh-db")
    calls.length = 0
    await lifecycle(parseDrenvArgs(["refresh-db", "proof"]))
    expect(calls).toEqual(["stop", "refresh-db"])
    expect(((await lifecycle({ command: "status" })) as { phase: string }[])[0].phase).toBe(
      "provisioned",
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it.each([
  ["", false, "schema-verified"],
  [
    "Built application schema differs from restored SQL; no runtime was started and no database was upgraded.",
    true,
    "schema-verified",
  ],
  ["Built application schema differs from restored SQL; mismatch", true, "stopped"],
  ["Foreign catalog", false, "schema-verified"],
])(
  "reconciles only a computed schema mismatch: %s",
  async (failure, expectedRefresh, refreshStatus) => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), "drenv-reconcile-")))
    const calls: string[] = []
    const lifecycle = createEnvironmentLifecycle(
      {
        directory,
        macRoot: join(directory, "mac"),
        windowsRoot: "C:\\DrenvTest",
        windowsHost: "devresults-vm",
      },
      {
        inventory: async () => ({ windowsPorts: [], macPorts: [] }),
        pair: async () => "a".repeat(40),
        provision: async () => {},
        windows: async (_m, operation) => {
          calls.push(operation)
          if (operation === "schema" && failure) throw new Error(failure)
          return { status: operation === "refresh-db" ? refreshStatus : "stopped" }
        },
      },
    )
    try {
      const result = lifecycle({ command: "create", id: "proof", snapshot: "/snapshot.json" })
      if (failure && !expectedRefresh) await expect(result).rejects.toThrow(failure)
      else if (expectedRefresh && refreshStatus !== "schema-verified")
        await expect(result).rejects.toThrow("did not verify")
      else await result
      expect(calls.includes("refresh-db")).toBe(expectedRefresh)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)
