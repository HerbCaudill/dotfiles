import { expect, test } from "vitest"
import { runLlm } from "../runLlm.ts"
import type { Harness, ProcessResult, Snapshot, Variant } from "../types.ts"

const opus: Variant = {
  costPerTask: 10,
  effort: "max",
  harness: "claude",
  intelligence: 58.4,
  model: "claude-opus-5-5",
}
const sol: Variant = {
  costPerTask: 1.27,
  effort: "max",
  harness: "codex",
  intelligence: 54.5,
  model: "gpt-6.1-sol",
}
const snapshot: Snapshot = {
  fetchedAt: "2026-11-01T00:00:00.000Z",
  floor: 9.7,
  indexVersion: 5,
  variants: [opus, sol],
}
const harnesses = { claude: createHarness("claude"), codex: createHarness("codex") }
const request = { level: 100, prompt: "Hello", sandbox: "read-only" as const }
const success: ProcessResult = { code: 0, stderr: "", stdout: "done" }

test("runs the resolved variant and returns its output", async () => {
  const ran: string[] = []
  const result = await runLlm(request, {
    execute: async invocation => (ran.push(invocation.command), success),
    harnesses,
    log: () => {},
    snapshot,
  })
  expect(ran).toEqual(["claude"])
  expect(result).toMatchObject({ output: "done", variant: opus })
})

test("falls back to another harness when a usage limit is hit", async () => {
  const logged: string[] = []
  const result = await runLlm(request, {
    execute: async invocation =>
      invocation.command === "claude"
        ? { code: 1, stderr: "You've hit your usage limit", stdout: "" }
        : success,
    harnesses,
    log: message => logged.push(message),
    snapshot,
  })
  expect(result.variant).toEqual(sol)
  expect(logged.join("\n")).toMatch(/claude-opus-5-5.*gpt-6.1-sol/s)
})

test("does not fall back on other failures", async () => {
  await expect(
    runLlm(request, {
      execute: async () => ({ code: 1, stderr: "bad prompt", stdout: "" }),
      harnesses,
      log: () => {},
      snapshot,
    }),
  ).rejects.toThrow(/bad prompt/)
})

test("does not leave a pinned harness", async () => {
  await expect(
    runLlm(
      { ...request, harness: "claude" },
      {
        execute: async () => ({ code: 1, stderr: "rate limit", stdout: "" }),
        harnesses,
        log: () => {},
        snapshot,
      },
    ),
  ).rejects.toThrow(/rate limit/)
})

/** Create a harness that runs a command named after itself. */
function createHarness(
  /** Harness name. */
  name: string,
): Harness {
  return {
    getInvocation: () => ({ args: [], command: name }),
    getModels: () => [],
    name,
    readOutput: result => result.stdout,
  }
}
