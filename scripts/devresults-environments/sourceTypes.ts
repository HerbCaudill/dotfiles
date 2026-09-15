import type { EnvironmentManifest } from "./types.ts"

/** Literal request passed to the Windows source transport. */
export type SourceRequest = {
  /** Registry-owned identity and native paths. */
  manifest: EnvironmentManifest
  /** Frozen complete Git object ID. */
  revision: string
  /** Initial pairing or committed source update. */
  operation: "pair" | "sync"
  /** Native private bundle file. */
  bundle: string
  /** Exact private ref in the bundle. */
  ref: string
}

/** Source transport substitution for tests and host adapters. */
export type SourceOptions = {
  /** Transfer a bundle and return the independently verified destination commit. */
  remote?: (request: SourceRequest) => Promise<string>
}
