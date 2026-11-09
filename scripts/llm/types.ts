/** Reasoning effort accepted by the harnesses. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max"

/** How much a headless run may do on the machine. */
export type Sandbox = "read-only" | "workspace-write" | "danger-full-access"

/** A row of the model roles table in the global agent instructions. */
export type Role = {
  /** Reasoning effort. */
  effort: Effort
  /** Name of the harness that runs this role. */
  harness: string
  /** Model ID as the harness expects it. */
  model: string
  /** Role name, such as `default` or `bulk`. */
  name: string
}

/** A command to start. */
export type Invocation = {
  /** Command line arguments. */
  args: string[]
  /** Executable to run. */
  command: string
  /** Standard input, when the harness changes the prompt. */
  input?: string
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
  /** Absolute paths of images the model should see. */
  images?: string[]
  /** Prompt text. */
  prompt: string
  /** Name of the model role to run. */
  role: string
  /** How much the run may do on the machine. */
  sandbox: Sandbox
  /** Path to a JSON Schema for the final message. */
  schemaPath?: string
  /** Time limit in milliseconds. */
  timeoutMs?: number
}

/** An adapter for one headless agent CLI. */
export type Harness = {
  /** Build the command that performs a request for a role. */
  getInvocation: (request: RunRequest, role: Role) => Invocation
  /** Harness name. */
  name: string
  /** Get the final message from a successful run. */
  readOutput: (result: ProcessResult, invocation: Invocation) => string
  /** Name used in the model roles table, such as "Claude Code". */
  title: string
}
