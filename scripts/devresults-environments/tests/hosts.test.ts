import { expect, test } from "vitest"
import { getRegistryOptions } from "../getRegistryOptions.ts"
import { parseDrenvArgs } from "../parseDrenvArgs.ts"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createRegistry } from "../createRegistry.ts"
import { submitNativeRequest, waitNativeRequest } from "../submitNativeRequest.ts"
import { writeFile } from "node:fs/promises"
import { createEnvironmentLifecycle } from "../createEnvironmentLifecycle.ts"
import { runDrenvCommand } from "../runDrenvCommand.ts"

test("Mac callers receive a request identity without forwarding private remote diagnostics", async () => {
  const ids: string[] = []
  await runDrenvCommand({
    executable: process.execPath,
    args: [
      "-e",
      "process.stderr.write('private fixture\\ndrenv request ');setTimeout(()=>process.stderr.write('12345678-1234-1234-1234-123456789abc; receipts: private-path\\n'),50)",
    ],
    onRequest: id => ids.push(id),
  })
  expect(ids).toEqual(["12345678-1234-1234-1234-123456789abc"])
})

test("mini commands select one native registry without a Mac source mapping", () => {
  const options = getRegistryOptions("mini", "win32")
  expect(options.directory).toBe("C:\\DevResultsEnvironments\\registry")
  expect(options.sourceMode).toBe("native-windows")
  expect(options.primarySource).toBe("C:\\Code\\DevResults\\devresults")
  expect(parseDrenvArgs(["--host", "mini", "status"])).toEqual({ command: "status", host: "mini" })
  expect(() => getRegistryOptions("-oProxyCommand=bad")).toThrow(/host/i)
  expect(parseDrenvArgs(["install-vibe", "alpha"])).toEqual({
    command: "install-vibe",
    id: "alpha",
  })
  expect(parseDrenvArgs(["request", "12345678-1234-1234-1234-123456789abc"])).toEqual({
    command: "request",
    id: "12345678-1234-1234-1234-123456789abc",
  })
})

test("identical native callers attach to one durable operation and can read its completed result", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-requests-"))
  try {
    const requests = await Promise.all(
      Array.from({ length: 3 }, () => submitNativeRequest(directory, ["start", "alpha"])),
    )
    expect(new Set(requests).size).toBe(1)
    await writeFile(
      join(directory, requests[0], "result.json"),
      JSON.stringify({ ok: true, value: { status: "running" } }),
    )
    expect(await waitNativeRequest(directory, requests[1])).toEqual({ status: "running" })
    expect(await submitNativeRequest(directory, ["start", "alpha"])).not.toBe(requests[0])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("native reservations omit Mac worktrees and allocate concurrent mini ports independently", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-native-"))
  try {
    const registry = createRegistry({ ...getRegistryOptions("mini", "win32"), directory })
    const manifests = await Promise.all(
      ["alpha", "beta"].map(id =>
        registry.reserve({ id, inventory: { windowsPorts: [30000], macPorts: [] } }),
      ),
    )
    expect(manifests.every(m => m.paths.mac === undefined)).toBe(true)
    expect(manifests[0].paths.windows).toMatch(/^C:\\DevResultsEnvironments\\source\\/)
    const ports = manifests.flatMap(m => Object.values(m.ports))
    expect(new Set(ports).size).toBe(12)
    expect(ports.every(port => port > 30000 && port < 40000)).toBe(true)
    expect(await registry.list()).toHaveLength(2)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("native stop drains both frontend workers before stopping IIS; partial start is reported failed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-stack-"))
  try {
    const options = { ...getRegistryOptions("mini", "win32"), directory }
    const registry = createRegistry(options)
    const manifest = await registry.reserve({
      id: "alpha",
      vibeSource: "C:\\Code\\Vibe",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    await registry.checkpoint("alpha", manifest.ownerToken, {
      phase: "provisioned",
      revision: "a".repeat(40),
    })
    const calls: string[] = []
    const lifecycle = createEnvironmentLifecycle(options, {
      windows: async (_m, operation) => {
        calls.push(`legacy:${operation}`)
        return { status: operation === "start" ? "running" : "stopped" }
      },
      vibe: async (_m, operation) => {
        calls.push(`vibe:${operation}`)
        if (operation === "start") throw new Error("foreign listener")
        return undefined
      },
      nativeWatch: async (_m, operation) => {
        calls.push(`client:${operation}`)
        return undefined
      },
    })
    await lifecycle({ command: "stop", id: "alpha" })
    expect(calls).toEqual(["client:stop", "vibe:stop", "legacy:stop"])
    calls.length = 0
    await expect(lifecycle({ command: "start", id: "alpha" })).rejects.toThrow("foreign listener")
    expect(calls).toEqual(["legacy:start", "vibe:start"])
    expect((await registry.get("alpha")).phase).toBe("failed")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("native viewing keeps each allocated port and binds the matching Mac hostname address", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-viewing-"))
  try {
    const options = { ...getRegistryOptions("mini", "win32"), directory }
    const manifest = await createRegistry(options).reserve({
      id: "viewing-proof",
      vibeSource: "C:\\Code\\Vibe",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    const urls = await createEnvironmentLifecycle(options)({ command: "url", id: manifest.id })
    expect(urls).toMatchObject({
      legacy: `https://example.devlocal.us:${manifest.ports.https}`,
      vibe: `https://example.viberesults.dev:${manifest.ports.vibe}`,
      tunnels: [
        `ssh -N -L 127.0.0.2:${manifest.ports.https}:127.0.0.1:${manifest.ports.https} mini`,
        `ssh -N -L 127.0.0.1:${manifest.ports.vibe}:127.0.0.1:${manifest.ports.vibe} mini`,
      ],
    })
    expect((await createRegistry(options).get(manifest.id)).phase).toBe(manifest.phase)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
