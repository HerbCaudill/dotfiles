/** Durable lifecycle checkpoints; a failed phase retains completed steps for retry. */
export type EnvironmentPhase =
  | "reserved"
  | "source-ready"
  | "provisioned"
  | "running"
  | "stopped"
  | "failed"
  | "removed"

/** A resource marker must match both fields before mutation or removal. */
export type Ownership = {
  /** Stable human-readable identity. */
  environmentId: string
  /** Random capability created once per reservation. */
  ownerToken: string
}

/** Versioned state shared by personal Mac and Windows tooling. Contains no credentials. */
export type EnvironmentManifest = {
  /** Schema version, rejected if unsupported. */
  version: 1
  /** Stable name used by every command. */
  id: string
  /** Random ownership capability copied into owned resource markers. */
  ownerToken: string
  /** Creation timestamp in ISO format. */
  createdAt: string
  /** Last persisted checkpoint timestamp. */
  updatedAt: string
  /** Resumable provisioning or runtime phase. */
  phase: EnvironmentPhase
  /** Steps with independently verified completed effects. */
  completedSteps: string[]
  /** Selected preset. */
  preset: "default" | "inl"
  /** Original revision selector, resolved once by the source worker. */
  requestedRevision: string
  /** Frozen full Git object ID after pairing. */
  revision?: string
  /** Read-only data source selection. */
  data: {
    /** Source SQL catalog to snapshot; never write here. */
    database: string
    /** Source instance identifier. */
    instance: string
  }
  /** SSH destination, never a filesystem mount. */
  windowsHost: string
  /** Native source and runtime paths. */
  paths: {
    /** Native Mac Git worktree. */
    mac: string
    /** Native Windows Git worktree. */
    windows: string
    /** Windows runtime root outside the source tree. */
    runtime: string
  }
  /** Requested ports; Windows must claim them under its own host lock before use. */
  ports: {
    /** IIS HTTPS endpoint. */
    https: number
    /** IIS HTTP endpoint. */
    http: number
    /** Azurite blob endpoint. */
    blob: number
    /** Azurite queue endpoint. */
    queue: number
    /** Azurite table endpoint. */
    table: number
    /** Optional Mac SSH forwarding endpoint. */
    tunnel: number
  }
  /** Owned SQL catalog, never a source catalog. */
  catalog: string
  /** Safe failure summary, excluding command output and credentials. */
  failure?: string
}

/** Registry configuration; all personal paths live outside primary checkouts. */
export type RegistryOptions = {
  /** Directory containing the registry and transaction lock. */
  directory: string
  /** Parent of native Mac worktrees. */
  macRoot: string
  /** Parent of native Windows source and runtime roots. */
  windowsRoot: string
  /** SSH config host alias. */
  windowsHost: string
}

/** A fresh read-only host inventory is required before reserving endpoints. */
export type ResourceInventory = {
  /** Windows listeners, HTTP.sys bindings/reservations, and other personal claims. */
  windowsPorts: number[]
  /** Mac listeners and other personal claims. */
  macPorts: number[]
}

/** Creation inputs become immutable identity after reservation. */
export type ReserveOptions = {
  /** Valid stable ID. */
  id: string
  /** Source database and instance preset. */
  preset?: "default" | "inl"
  /** Revision to freeze; defaults to HEAD in the explicit source checkout. */
  revision?: string
  /** Explicit source SQL database. */
  database?: string
  /** Explicit source instance. */
  instance?: string
  /** Fresh host inventory. */
  inventory: ResourceInventory
}

/** A verified lifecycle update cannot change reserved resource identity. */
export type EnvironmentCheckpoint = {
  /** New durable phase. */
  phase: EnvironmentPhase
  /** Idempotent completed step name. */
  completedStep?: string
  /** Fully resolved revision after successful pairing or an explicit verified sync. */
  revision?: string
  /** Sanitized failure description, cleared by a successful checkpoint. */
  failure?: string
}

/** Parsed public command surface; orchestration injects command handlers. */
export type DrenvArgs = {
  /** Lifecycle or inspection operation. */
  command:
    | "create"
    | "sync"
    | "start"
    | "status"
    | "url"
    | "open"
    | "stop"
    | "snapshot"
    | "reset"
    | "remove"
    | "help"
  /** Required except for status and help. */
  id?: string
  /** Creation data preset. */
  preset?: "default" | "inl"
  /** Creation revision selector. */
  revision?: string
  /** Explicit creation SQL source. */
  database?: string
  /** Explicit creation source instance. */
  instance?: string
  /** Explicit native Mac source checkout; source worker validates it. */
  source?: string
  /** Explicit coordinated snapshot receipt; provisioning worker validates it. */
  snapshot?: string
}
