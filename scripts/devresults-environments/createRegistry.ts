import { randomUUID } from "node:crypto"
import { readFile, rename, writeFile } from "node:fs/promises"
import { isAbsolute, join, resolve, win32 } from "node:path"
import { assertEnvironmentId } from "./assertEnvironmentId.ts"
import { withRegistryLock } from "./withRegistryLock.ts"
import type {
  EnvironmentCheckpoint,
  EnvironmentManifest,
  Ownership,
  RegistryOptions,
  ReserveOptions,
} from "./types.ts"

/** Build the sole writer for the personal registry; every read validates the entire mapping. */
export function createRegistry(
  /** Fixed host and native root configuration. */
  options: RegistryOptions,
) {
  if (
    !isAbsolute(options.directory) ||
    !isAbsolute(options.macRoot) ||
    options.macRoot.startsWith("/Volumes/")
  )
    throw new Error("Registry and Mac roots must be absolute native paths")
  if (
    !/^[A-Za-z]:\\/.test(options.windowsRoot) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(options.windowsHost)
  )
    throw new Error("Expected a native Windows root and SSH host alias")
  const directory = resolve(options.directory)
  const filename = join(directory, "registry.json")

  /** Read a complete validated snapshot under the transaction lock. */
  async function read(): Promise<EnvironmentManifest[]> {
    let contents: string
    try {
      contents = await readFile(filename, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }
    const registry = JSON.parse(contents)
    if (registry?.version !== 1 || !Array.isArray(registry.environments))
      throw new Error("Unsupported or corrupt environment registry")
    validateMappings(registry.environments)
    for (const environment of registry.environments as EnvironmentManifest[]) {
      if (
        resolve(environment.paths.mac) !== resolve(options.macRoot, environment.id) ||
        win32.normalize(environment.paths.windows).toLowerCase() !==
          win32.join(options.windowsRoot, "source", environment.id).toLowerCase() ||
        win32.normalize(environment.paths.runtime).toLowerCase() !==
          win32.join(options.windowsRoot, "runtime", environment.id).toLowerCase() ||
        environment.windowsHost !== options.windowsHost
      )
        throw new Error(
          "Foreign resource mapping: registry does not match the configured native roots and host",
        )
    }
    return registry.environments
  }

  /** Publish one entire transaction atomically; a crash preserves the previous file. */
  async function write(
    /** New validated manifest collection. */
    environments: EnvironmentManifest[],
  ) {
    validateMappings(environments)
    const temporary = join(directory, `registry-${randomUUID()}.tmp`)
    await writeFile(temporary, JSON.stringify({ version: 1, environments }, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    })
    await rename(temporary, filename)
  }

  return {
    directory,
    /** Read all environments, including removed tombstones that prevent accidental reuse. */
    list: () => withRegistryLock(directory, read),
    /** Resolve exactly one registered ID, never a branch or current-directory guess. */
    get: (id: string) =>
      withRegistryLock(directory, async () => requireEnvironment(await read(), id)),
    /** Reserve identity and proposed endpoints after fresh read-only host discovery. */
    reserve: (input: ReserveOptions) =>
      withRegistryLock(directory, async () => {
        assertEnvironmentId(input.id)
        const environments = await read()
        const preset = input.preset ?? "default"
        if (preset !== "default" && preset !== "inl") throw new Error("Invalid preset")
        const data = {
          database: input.database ?? (preset === "inl" ? "dev-inl" : "dev"),
          instance: input.instance ?? (preset === "inl" ? "inl" : "example"),
        }
        if (
          !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(data.database) ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/.test(data.instance)
        )
          throw new Error("Invalid source database or instance")
        if (data.database.toLowerCase() === `drenv_${input.id.replaceAll("-", "_")}`)
          throw new Error("Source database cannot be the environment catalog")
        const requestedRevision = input.revision ?? "HEAD"
        if (
          !requestedRevision ||
          requestedRevision.startsWith("-") ||
          /[\s\x00-\x1f]/.test(requestedRevision)
        )
          throw new Error("Invalid revision selector")
        const existing = environments.find(environment => environment.id === input.id)
        if (existing) {
          if (existing.phase === "removed")
            throw new Error("Removed environment identity cannot be reused")
          if (
            existing.preset !== preset ||
            existing.requestedRevision !== requestedRevision ||
            JSON.stringify(existing.data) !== JSON.stringify(data)
          )
            throw new Error("Environment already exists with different creation options")
          return existing
        }
        if (
          !input.inventory ||
          !Array.isArray(input.inventory.windowsPorts) ||
          !Array.isArray(input.inventory.macPorts)
        )
          throw new Error("Fresh Mac and Windows resource inventory is required")
        const occupied = new Set([
          ...reservedPorts,
          ...input.inventory.windowsPorts,
          ...input.inventory.macPorts,
          ...environments.flatMap(environment => Object.values(environment.ports)),
        ])
        for (const port of occupied)
          if (!Number.isInteger(port) || port < 1 || port > 65535)
            throw new Error("Invalid inventory port")
        const allocated: number[] = []
        for (let port = 20000; port <= 65535 && allocated.length < 6; port++)
          if (!occupied.has(port)) allocated.push(port)
        if (allocated.length !== 6) throw new Error("No free environment ports available")
        const [https, http, blob, queue, table, tunnel] = allocated
        const timestamp = new Date().toISOString()
        const environment: EnvironmentManifest = {
          version: 1,
          id: input.id,
          ownerToken: randomUUID(),
          createdAt: timestamp,
          updatedAt: timestamp,
          phase: "reserved",
          completedSteps: [],
          preset,
          requestedRevision,
          data,
          windowsHost: options.windowsHost,
          paths: {
            mac: join(options.macRoot, input.id),
            windows: win32.join(options.windowsRoot, "source", input.id),
            runtime: win32.join(options.windowsRoot, "runtime", input.id),
          },
          ports: { https, http, blob, queue, table, tunnel },
          catalog: `drenv_${input.id.replaceAll("-", "_")}`,
        }
        await write([...environments, environment])
        return environment
      }),
    /** Persist only verified lifecycle progress, preserving all reserved resource identities. */
    checkpoint: (id: string, ownerToken: string, checkpoint: EnvironmentCheckpoint) =>
      withRegistryLock(directory, async () => {
        const environments = await read()
        const current = requireEnvironment(environments, id)
        if (current.ownerToken !== ownerToken) throw new Error("Ownership mismatch")
        if (current.phase === "removed") throw new Error("Removed environment cannot be changed")
        if (!phases.includes(checkpoint.phase)) throw new Error("Invalid lifecycle phase")
        if (checkpoint.revision !== undefined && !/^[a-f0-9]{40}$/.test(checkpoint.revision))
          throw new Error("Checkpoint revision must be a full Git commit SHA")
        const next: EnvironmentManifest = {
          ...current,
          phase: checkpoint.phase,
          updatedAt: new Date().toISOString(),
          failure: checkpoint.failure,
          revision: checkpoint.revision ?? current.revision,
          completedSteps: checkpoint.completedStep
            ? [...new Set([...current.completedSteps, checkpoint.completedStep])]
            : current.completedSteps,
        }
        await write(environments.map(environment => (environment.id === id ? next : environment)))
        return next
      }),
    /** Check an observed resource marker before any foreign-resource-sensitive operation. */
    assertOwnership: (id: string, observed: Ownership) =>
      withRegistryLock(directory, async () => {
        const environment = requireEnvironment(await read(), id)
        if (observed.environmentId !== id || observed.ownerToken !== environment.ownerToken)
          throw new Error("Foreign resource: environment ID and ownership token must both match")
        return environment
      }),
  }
}

/** Refuse partial, unsupported, duplicate or overlapping registry records. */
function validateMappings(
  /** Untrusted JSON loaded from durable storage. */
  environments: EnvironmentManifest[],
) {
  const ids = new Set<string>()
  const tokens = new Set<string>()
  const paths: string[] = []
  const catalogs = new Set<string>()
  const ports = new Set<number>()
  for (const environment of environments) {
    if (!environment || environment.version !== 1 || typeof environment.id !== "string")
      throw new Error("Corrupt environment manifest")
    assertEnvironmentId(environment.id)
    if (
      !/^[0-9a-f-]{36}$/.test(environment.ownerToken) ||
      !phases.includes(environment.phase) ||
      !Array.isArray(environment.completedSteps) ||
      environment.completedSteps.some(step => typeof step !== "string") ||
      !environment.paths ||
      !environment.ports ||
      !environment.data ||
      !environment.windowsHost ||
      !environment.requestedRevision ||
      !["default", "inl"].includes(environment.preset)
    )
      throw new Error("Corrupt environment manifest")
    if (
      !isAbsolute(environment.paths.mac) ||
      !/^[A-Za-z]:\\/.test(environment.paths.windows) ||
      !/^[A-Za-z]:\\/.test(environment.paths.runtime) ||
      environment.paths.mac.startsWith("/Volumes/") ||
      environment.catalog !== `drenv_${environment.id.replaceAll("-", "_")}`
    )
      throw new Error("Unsafe environment resource mapping")
    if (
      ids.has(environment.id) ||
      tokens.has(environment.ownerToken) ||
      catalogs.has(environment.catalog)
    )
      throw new Error("Ambiguous environment identity or catalog mapping")
    ids.add(environment.id)
    tokens.add(environment.ownerToken)
    catalogs.add(environment.catalog)
    const mappedPaths = [
      resolve(environment.paths.mac).toLowerCase(),
      win32.normalize(environment.paths.windows).toLowerCase().replaceAll("\\", "/"),
      win32.normalize(environment.paths.runtime).toLowerCase().replaceAll("\\", "/"),
    ]
    for (const path of mappedPaths) {
      if (
        paths.some(
          existing =>
            existing === path || existing.startsWith(path + "/") || path.startsWith(existing + "/"),
        )
      )
        throw new Error("Ambiguous or overlapping environment path mapping")
      paths.push(path)
    }
    for (const key of ["https", "http", "blob", "queue", "table", "tunnel"] as const) {
      const port = environment.ports[key]
      if (
        !Number.isInteger(port) ||
        port < 20000 ||
        port > 65535 ||
        reservedPorts.includes(port) ||
        ports.has(port)
      )
        throw new Error("Ambiguous or unsafe environment port mapping")
      ports.add(port)
    }
  }
}

/** Require exact environment identity for all reads and changes. */
function requireEnvironment(
  /** Validated registry manifests. */
  environments: EnvironmentManifest[],
  /** Requested stable ID. */
  id: string,
) {
  assertEnvironmentId(id)
  const environment = environments.find(candidate => candidate.id === id)
  if (!environment) throw new Error(`Unknown environment: ${id}`)
  return environment
}

const phases = [
  "reserved",
  "source-ready",
  "provisioned",
  "running",
  "stopped",
  "failed",
  "removed",
]
const reservedPorts = [
  443, 444, 8080, 8100, 8443, 8444, 9443, 9444, 9445, 10000, 10001, 10002, 10010, 10011, 10012,
  44400,
]
