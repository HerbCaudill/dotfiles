import { DEFAULT_TIMEOUT_MS } from "./constants.ts"
import { isFailedResult } from "./isFailedResult.ts"
import { isUsageLimitFailure } from "./isUsageLimitFailure.ts"
import { resolveVariant } from "./resolveVariant.ts"
import type { Harness, Invocation, ProcessResult, RunRequest, Snapshot, Variant } from "./types.ts"

/** Run a prompt on the resolved variant, moving to another harness if a usage limit runs out. */
export async function runLlm(
  /** What the caller asked for. */
  request: RunRequest,
  /** Scores and side effects. */
  dependencies: RunLlmDependencies,
): Promise<RunLlmResult> {
  const { execute, harnesses, log, snapshot } = dependencies
  const excludedHarnesses: string[] = []
  let previous: Variant | undefined

  while (true) {
    const variant = resolveVariant(snapshot, {
      excludedHarnesses,
      harness: request.harness,
      level: request.level,
    })
    if (previous) log(`Falling back from ${previous.model} to ${variant.model}: usage limit`)

    const harness = harnesses[variant.harness]
    if (!harness) throw new Error(`Unknown harness: ${variant.harness}`)
    const invocation = harness.getInvocation(request, variant)
    const result = await execute(invocation, {
      cwd: request.cwd,
      prompt: request.prompt,
      timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
    if (!isFailedResult(result)) return { output: harness.readOutput(result, invocation), variant }

    const message = `${variant.model} failed: ${result.stderr.trim() || result.stdout.trim()}`
    const hasFallback =
      !request.harness &&
      snapshot.variants.some(
        other => other.harness !== variant.harness && !excludedHarnesses.includes(other.harness),
      )
    if (!isUsageLimitFailure(result) || !hasFallback) throw new Error(message)
    excludedHarnesses.push(variant.harness)
    previous = variant
  }
}

export type RunLlmDependencies = {
  /** Start a harness. */
  execute: (
    invocation: Invocation,
    options: { cwd?: string; prompt: string; timeoutMs: number },
  ) => Promise<ProcessResult>
  /** Harness adapters by name. */
  harnesses: Record<string, Harness>
  /** Write a diagnostic line. */
  log: (message: string) => void
  /** Scores and scale. */
  snapshot: Snapshot
}

export type RunLlmResult = {
  /** The harness's final message. */
  output: string
  /** The variant that produced it. */
  variant: Variant
}
