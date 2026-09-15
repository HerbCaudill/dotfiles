import { win32 } from "node:path"
import type { EnvironmentManifest } from "./types.ts"

/** Validate an operator-coordinated immutable SQL/blob snapshot before any remote mutation. */
export function validateSnapshotReceipt(
  /** Parsed receipt, never trusted solely because it is JSON. */
  input: unknown,
  /** Frozen source revision and selected data source. */
  manifest: Pick<EnvironmentManifest, "revision" | "data">,
): SnapshotReceipt {
  const value = input as SnapshotReceipt
  if (!value || value.version !== 1) throw new Error("Unsupported coordinated snapshot receipt")
  if (!manifest.revision || !/^[a-f0-9]{40}$/.test(value.revision))
    throw new Error("Snapshot source revision and frozen build revision are required")
  if (
    value.sourceDatabase !== manifest.data.database ||
    value.sourceInstance !== manifest.data.instance
  )
    throw new Error("Snapshot data source does not match the environment")
  if (typeof value.schemaHash !== "string" || !value.schemaHash.trim())
    throw new Error("Snapshot schema hash is required")
  const coordination = value.coordination
  if (!coordination || coordination.method !== "writers-paused" || !coordination.evidence?.trim())
    throw new Error(
      "A coordinated SQL/blob snapshot with evidence of paused writers is required; foreign runtimes are never stopped automatically",
    )
  if (
    !Number.isFinite(Date.parse(coordination.startedAt)) ||
    !Number.isFinite(Date.parse(coordination.completedAt)) ||
    Date.parse(coordination.completedAt) < Date.parse(coordination.startedAt)
  )
    throw new Error("Invalid snapshot coordination window")
  for (const artifact of [value.sql, value.blobs]) {
    if (
      !artifact ||
      typeof artifact.path !== "string" ||
      !/^[A-Za-z]:\\/.test(artifact.path) ||
      win32.normalize(artifact.path) !== artifact.path ||
      artifact.path.includes("..") ||
      /[<>|?*\x00-\x1f]/.test(artifact.path) ||
      artifact.path.slice(2).includes(":")
    )
      throw new Error("Snapshots must use canonical native Windows paths")
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256))
      throw new Error("Snapshot artifact SHA256 is required")
  }
  if (
    !Number.isSafeInteger(value.sql.allocatedBytes) ||
    value.sql.allocatedBytes <= 0 ||
    !Number.isSafeInteger(value.blobs.bytes) ||
    value.blobs.bytes < 0
  )
    throw new Error("Snapshot sizes must describe the full restored data")
  return value
}

/** Receipt generated while every SQL/blob writer was coordinated and paused. It contains no secrets. */
export type SnapshotReceipt = {
  /** Receipt format. */
  version: 1
  /** Read-only source catalog. */
  sourceDatabase: string
  /** Selected instance. */
  sourceInstance: string
  /** Source revision recorded at capture time; current build compatibility is checked independently. */
  revision: string
  /** Actual dbo._Global SchemaHash from the compatible database. */
  schemaHash: string
  /** Attestation to an externally coordinated writer pause covering both artifacts. */
  coordination: {
    /** Only coordinated stopped-writer captures are supported. */
    method: "writers-paused"
    /** Beginning of the shared pause. */
    startedAt: string
    /** End of both captures before writers resumed. */
    completedAt: string
    /** Concrete operator or owned-runtime evidence. */
    evidence: string
  }
  /** SQL backup and restored file allocation. */
  sql: {
    /** Native path to a SQL Server backup. */
    path: string
    /** SHA256 of the immutable backup bytes. */
    sha256: string
    /** Total SQL file sizes from RESTORE FILELISTONLY. */
    allocatedBytes: number
  }
  /** Azurite data directory captured in the same pause. */
  blobs: {
    /** Native path to the stopped Azurite directory. */
    path: string
    /** SHA256 of sorted relative-path, byte-length, file-SHA256 lines (see runtime contract). */
    sha256: string
    /** Total file bytes. */
    bytes: number
  }
}
