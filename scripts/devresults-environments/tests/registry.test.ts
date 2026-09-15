import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createRegistry } from "../createRegistry.ts"
import { parseDrenvArgs } from "../parseDrenvArgs.ts"

const directories: string[] = []

/** Give each test its own registry and resource roots. */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "drenv-test-"))
  directories.push(root)
  return createRegistry({
    directory: root,
    macRoot: join(root, "worktrees"),
    windowsRoot: "C:\\drenv",
    windowsHost: "devresults-vm",
  })
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })),
  )
})

describe("environment registry", () => {
  it.each([
    { data: { database: "DRENV_FEATURE", instance: "example" } },
    { data: { database: "bad;catalog", instance: "example" } },
    { data: { database: "dev", instance: "../tenant" } },
    { data: { database: 123, instance: "example" } },
    { data: { database: "dev" } },
    { requestedRevision: "--upload-pack=other" },
    { requestedRevision: "HEAD\nother" },
    { requestedRevision: 123 },
    { revision: "--not-a-sha" },
    { revision: "abc123" },
    { revision: null },
  ])("refuses corrupted source or revision fields on reads: %j", async patch => {
    const registry = await fixture()
    const environment = await registry.reserve({
      id: "feature",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    await writeFile(
      join(registry.directory, "registry.json"),
      JSON.stringify({ version: 1, environments: [{ ...environment, ...patch }] }),
    )
    await expect(registry.get("feature")).rejects.toThrow()
    await expect(registry.list()).rejects.toThrow()
  })

  it("reads a valid persisted full revision and explicit source selection", async () => {
    const registry = await fixture()
    const environment = await registry.reserve({
      id: "feature",
      database: "dev-inl",
      instance: "inl",
      revision: "main~1",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    await registry.checkpoint(environment.id, environment.ownerToken, {
      phase: "source-ready",
      revision: "a".repeat(40),
    })
    expect((await registry.get(environment.id)).revision).toBe("a".repeat(40))
  })

  it("refuses to alias the source database to the owned destination", async () => {
    const registry = await fixture()
    await expect(
      registry.reserve({
        id: "feature",
        database: "DRENV_FEATURE",
        inventory: { windowsPorts: [], macPorts: [] },
      }),
    ).rejects.toThrow("Source database cannot be the environment catalog")
  })

  it("refuses a foreign native path even when the record retains a valid ownership token", async () => {
    const registry = await fixture()
    const environment = await registry.reserve({
      id: "feature",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    await writeFile(
      join(registry.directory, "registry.json"),
      JSON.stringify({
        version: 1,
        environments: [
          { ...environment, paths: { ...environment.paths, windows: "C:\\Code\\DevResults" } },
        ],
      }),
    )
    await expect(registry.get("feature")).rejects.toThrow("Foreign resource mapping")
  })
  it("serializes concurrent allocations and excludes discovered occupied ports", async () => {
    const registry = await fixture()
    const environments = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        registry.reserve({
          id: `test-${index}`,
          inventory: { windowsPorts: [20000, 20001], macPorts: [20002] },
        }),
      ),
    )
    const ports = environments.flatMap(environment => Object.values(environment.ports))
    expect(new Set(ports).size).toBe(ports.length)
    expect(ports).not.toContain(20000)
    expect(ports).not.toContain(20001)
    expect(ports).not.toContain(20002)
    expect((await registry.list()).length).toBe(12)
  })

  it("resumes the same identity and rejects conflicting create arguments", async () => {
    const registry = await fixture()
    const first = await registry.reserve({
      id: "inl-feature",
      preset: "inl",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    expect(first.data).toEqual({ database: "dev-inl", instance: "inl" })
    expect(
      await registry.reserve({
        id: "inl-feature",
        preset: "inl",
        inventory: { windowsPorts: [], macPorts: [] },
      }),
    ).toEqual(first)
    await expect(
      registry.reserve({ id: "inl-feature", inventory: { windowsPorts: [], macPorts: [] } }),
    ).rejects.toThrow("different creation options")
  })

  it("refuses invalid IDs before creating any resource", async () => {
    const registry = await fixture()
    for (const id of ["../primary", "Dev", "a/b", "a;whoami", "", "a".repeat(41)]) {
      await expect(
        registry.reserve({ id, inventory: { windowsPorts: [], macPorts: [] } }),
      ).rejects.toThrow("Invalid environment ID")
    }
    expect(await registry.list()).toEqual([])
  })

  it("requires the matching ownership token for lifecycle writes", async () => {
    const registry = await fixture()
    const environment = await registry.reserve({
      id: "example",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    await expect(
      registry.checkpoint("example", "foreign", { phase: "source-ready" }),
    ).rejects.toThrow("Ownership mismatch")
    const ready = await registry.checkpoint("example", environment.ownerToken, {
      phase: "source-ready",
      completedStep: "paired-source",
    })
    expect(ready.completedSteps).toContain("paired-source")
    expect(ready.ownerToken).toBe(environment.ownerToken)
    await expect(
      registry.assertOwnership("example", {
        environmentId: "other",
        ownerToken: environment.ownerToken,
      }),
    ).rejects.toThrow("Foreign resource")
  })

  it("refuses ambiguous mappings instead of selecting the first entry", async () => {
    const registry = await fixture()
    const first = await registry.reserve({
      id: "first",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    const second = await registry.reserve({
      id: "second",
      inventory: { windowsPorts: [], macPorts: [] },
    })
    await writeFile(
      join(registry.directory, "registry.json"),
      JSON.stringify({
        version: 1,
        environments: [
          first,
          { ...second, paths: { ...second.paths, windows: first.paths.windows.toUpperCase() } },
        ],
      }),
    )
    await expect(registry.get("first")).rejects.toThrow("Ambiguous")
  })
})

describe("personal command arguments", () => {
  it("selects defaults and accepts explicit source data and frozen revision selection", () => {
    expect(
      parseDrenvArgs([
        "create",
        "test",
        "--preset",
        "inl",
        "--revision",
        "abc123",
        "--database",
        "custom",
        "--instance",
        "tenant",
      ]),
    ).toEqual({
      command: "create",
      id: "test",
      preset: "inl",
      revision: "abc123",
      database: "custom",
      instance: "tenant",
    })
    expect(parseDrenvArgs(["status"])).toEqual({ command: "status" })
    expect(
      parseDrenvArgs([
        "create",
        "test",
        "--source",
        "/native/source",
        "--snapshot",
        "/private/receipt.json",
      ]),
    ).toEqual({
      command: "create",
      id: "test",
      source: "/native/source",
      snapshot: "/private/receipt.json",
    })
    expect(() => parseDrenvArgs(["stop"])).toThrow("requires an environment ID")
    expect(() => parseDrenvArgs(["create", "test", "--unknown"])).toThrow("Unknown option")
    expect(() => parseDrenvArgs(["stop", "test", "--preset", "inl"])).toThrow(
      "only valid for create",
    )
  })
})
