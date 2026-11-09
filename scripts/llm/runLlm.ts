import { DEFAULT_TIMEOUT_MS } from "./constants.ts"
import { isFailedResult } from "./isFailedResult.ts"
import { resolveRole } from "./resolveRole.ts"
import type { Harness, Invocation, ProcessResult, Role, RunRequest } from "./types.ts"

/** Run a prompt with the harness, model and effort of a role. */
export async function runLlm(
  /** What the caller asked for. */
  request: RunRequest,
  /** Roles and side effects. */
  dependencies: RunLlmDependencies,
): Promise<RunLlmResult> {
  const { execute, harnesses, roles } = dependencies
  const role = resolveRole(roles, request.role)
  const harness = harnesses[role.harness]
  if (!harness) throw new Error(`Unknown harness: ${role.harness}`)

  const invocation = harness.getInvocation(request, role)
  const result = await execute(invocation, {
    cwd: request.cwd,
    prompt: invocation.input ?? request.prompt,
    timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
  if (isFailedResult(result))
    throw new Error(`${role.model} failed: ${result.stderr.trim() || result.stdout.trim()}`)
  return { output: harness.readOutput(result, invocation), role }
}

export type RunLlmDependencies = {
  /** Start a harness. */
  execute: (
    invocation: Invocation,
    options: { cwd?: string; prompt: string; timeoutMs: number },
  ) => Promise<ProcessResult>
  /** Harness adapters by name. */
  harnesses: Record<string, Harness>
  /** The model roles table. */
  roles: Role[]
}

export type RunLlmResult = {
  /** The harness's final message. */
  output: string
  /** The role that produced it. */
  role: Role
}
