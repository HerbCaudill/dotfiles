/** Reasoning effort accepted by the harnesses. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max"

/** How much a headless run may do on the machine. */
export type Sandbox = "read-only" | "workspace-write" | "danger-full-access"

/** One way to run a model: a harness, a model ID and an effort level. */
export type Variant = {
  /** Artificial Analysis cost per benchmark task, in USD. */
  costPerTask: number
  /** Reasoning effort. */
  effort: Effort
  /** Name of the harness that runs this variant. */
  harness: string
  /** Artificial Analysis intelligence index. */
  intelligence: number
  /** Model ID as the harness expects it. */
  model: string
}

/** The local record of runnable variants and the scale they sit on. */
export type Snapshot = {
  /** When the scores were fetched. */
  fetchedAt: string
  /** Score that level 0 maps to. */
  floor: number
  /** Artificial Analysis index version the scores belong to. */
  indexVersion: number
  /** Variants that have already passed a test call. */
  testedVariantKeys?: string[]
  /** All runnable variants. */
  variants: Variant[]
}

/** A model entry from the Artificial Analysis free API. */
export type ArtificialAnalysisModel = {
  /** Cost of running the intelligence index. */
  artificial_analysis_intelligence_index_cost?: {
    /** Average cost across benchmark tasks. */
    cost_per_task?: {
      /** Cost per task in USD. */
      total_cost?: number | null
    } | null
  } | null
  /** Benchmark scores. */
  evaluations?: {
    /** The composite intelligence score. */
    artificial_analysis_intelligence_index?: number | null
  } | null
  /** Display name, which carries the effort level. */
  name: string
  /** API slug. */
  slug: string
}

/** A command to start. */
export type Invocation = {
  /** Command line arguments. */
  args: string[]
  /** Executable to run. */
  command: string
  /** File the harness writes its final message to. */
  outputPath?: string
}

/** The result of a finished process. */
export type ProcessResult = {
  /** Exit code, or null if the process was killed. */
  code: number | null
  /** Captured standard error. */
  stderr: string
  /** Captured standard output. */
  stdout: string
}

/** What a caller asks for, independent of any harness. */
export type RunRequest = {
  /** Working directory for the run. */
  cwd?: string
  /** Stay on this harness rather than choosing or falling back. */
  harness?: string
  /** Required intelligence from 0 to 100. */
  level: number
  /** Prompt text. */
  prompt: string
  /** How much the run may do on the machine. */
  sandbox: Sandbox
  /** Path to a JSON Schema for the final message. */
  schemaPath?: string
  /** Time limit in milliseconds. */
  timeoutMs?: number
}

/** An adapter for one headless agent CLI. */
export type Harness = {
  /** Build the command that performs a request on a variant. */
  getInvocation: (request: RunRequest, variant: Variant) => Invocation
  /** Get the model IDs this harness runs for an Artificial Analysis base slug. */
  getModels: (baseSlug: string) => string[]
  /** Harness name. */
  name: string
  /** Get the final message from a successful run. */
  readOutput: (result: ProcessResult, invocation: Invocation) => string
}
