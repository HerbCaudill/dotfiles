import { describe, expect, it } from "vitest"
import { validateSnapshotReceipt } from "../validateSnapshotReceipt.ts"

const receipt = {
  version: 1,
  sourceDatabase: "dev",
  sourceInstance: "example",
  revision: "a".repeat(40),
  schemaHash: "schema-1",
  coordination: {
    method: "writers-paused",
    startedAt: "2026-09-15T08:00:00Z",
    completedAt: "2026-09-15T08:01:00Z",
    evidence: "operator-coordinated SQL backup and stopped Azurite copy",
  },
  sql: {
    path: "C:\\Snapshots\\one\\database.bak",
    sha256: "b".repeat(64),
    allocatedBytes: 6_000_000_000,
  },
  blobs: { path: "C:\\Snapshots\\one\\blobs", sha256: "c".repeat(64), bytes: 12_000_000 },
}
const target = { revision: receipt.revision, data: { database: "dev", instance: "example" } }

describe("coordinated snapshot validation", () => {
  it("accepts useful SQL/blob data from the selected source and frozen revision", () => {
    expect(validateSnapshotReceipt(receipt, target)).toEqual(receipt)
  })
  it.each([
    { ...receipt, coordination: undefined },
    { ...receipt, coordination: { ...receipt.coordination, method: "live-copy" } },
    { ...receipt, coordination: { ...receipt.coordination, evidence: "" } },
    { ...receipt, coordination: { ...receipt.coordination, completedAt: "2026-09-14T08:01:00Z" } },
    { ...receipt, sourceDatabase: "dev-inl" },
    { ...receipt, sourceInstance: "inl" },
    { ...receipt, revision: "invalid" },
    { ...receipt, schemaHash: "" },
    { ...receipt, sql: { ...receipt.sql, path: "\\\\Mac\\Home\\backup.bak" } },
    { ...receipt, sql: { ...receipt.sql, allocatedBytes: -1 } },
    { ...receipt, blobs: { ...receipt.blobs, sha256: "invalid" } },
  ])("refuses uncoordinated, incompatible or unverifiable snapshots", input => {
    expect(() => validateSnapshotReceipt(input, target)).toThrow()
  })
})

import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, vi } from "vitest"
import { provisionWindowsEnvironment } from "../provisionWindowsEnvironment.ts"
import type { EnvironmentManifest } from "../types.ts"

const temporary: string[] = []
afterEach(async () => {
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})
const manifest = {
  ...target,
  id: "test",
  ownerToken: "token",
  windowsHost: "devresults-vm",
} as EnvironmentManifest

it("refuses missing coordinated snapshots before transport", async () => {
  const run = vi.fn()
  await expect(provisionWindowsEnvironment(manifest, { run })).rejects.toThrow("--snapshot")
  expect(run).not.toHaveBeenCalled()
})
it("keeps executable consumer code separate from private data and verifies returned ownership", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-provision-"))
  temporary.push(directory)
  const path = join(directory, "snapshot.json")
  await writeFile(path, JSON.stringify(receipt))
  const run = vi.fn().mockResolvedValue({
    stdout: JSON.stringify({
      ok: true,
      environmentId: "foreign",
      ownerToken: "token",
      revision: target.revision,
      status: "provisioned",
    }),
    stderr: "",
  })
  await expect(provisionWindowsEnvironment(manifest, { snapshot: path, run })).rejects.toThrow(
    "does not match",
  )
  const [consumer, request, options] = run.mock.calls[0]
  expect(consumer).not.toContain(manifest.ownerToken)
  expect(request.snapshot).toEqual(receipt)
  expect(options.host).toBe("devresults-vm")
})
it("preserves concrete sanitized Windows prerequisites", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-provision-"))
  temporary.push(directory)
  const path = join(directory, "snapshot.json")
  await writeFile(path, JSON.stringify(receipt))
  const run = vi.fn().mockResolvedValue({
    stdout: JSON.stringify({ ok: false, prerequisite: "Expand Windows C: to 8 GiB free" }),
    stderr: "",
  })
  await expect(provisionWindowsEnvironment(manifest, { snapshot: path, run })).rejects.toThrow(
    "Expand Windows C:",
  )
})

it("preserves an older snapshot revision as provenance for independently checked current builds", () => {
  const prior = { ...receipt, revision: "d".repeat(40) }
  expect(validateSnapshotReceipt(prior, target).revision).toBe(prior.revision)
})
