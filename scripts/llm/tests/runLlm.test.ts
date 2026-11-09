import { expect, test } from "vitest"
import { runLlm } from "../runLlm.ts"
import type { Harness, ProcessResult, Role } from "../types.ts"

const roles: Role[] = [
  { effort: "high", harness: "claude", model: "claude-opus-5-5", name: "default" },
  { effort: "low", harness: "codex", model: "gpt-6-luna", name: "bulk-min" },
]
const harnesses = { claude: createHarness("claude"), codex: createHarness("codex") }
const request = { prompt: "Hello", role: "bulk-min", sandbox: "read-only" as const }
const success: ProcessResult = { code: 0, stderr: "", stdout: "done" }

test("runs the role's harness and model and returns its output", async () => {
  const ran: string[] = []
  const result = await runLlm(request, {
    execute: async invocation => (ran.push(invocation.args.join(" ")), success),
    harnesses,
    roles,
  })
  expect(ran).toEqual(["codex gpt-6-luna low"])
  expect(result).toEqual({ output: "done", role: roles[1] })
})

test("rejects an unknown role", async () => {
  await expect(
    runLlm({ ...request, role: "turbo" }, { execute: async () => success, harnesses, roles }),
  ).rejects.toThrow(/turbo.*default, bulk-min/)
})

test("reports a failed run without trying another model", async () => {
  const ran: string[] = []
  await expect(
    runLlm(request, {
      execute: async invocation => (
        ran.push(invocation.command),
        { code: 1, stderr: "You've hit your usage limit", stdout: "" }
      ),
      harnesses,
      roles,
    }),
  ).rejects.toThrow(/usage limit/)
  expect(ran).toEqual(["codex"])
})

/** Create a harness that echoes its name and role in its arguments. */
function createHarness(
  /** Harness name. */
  name: string,
): Harness {
  return {
    getInvocation: (_request, role) => ({
      args: [name, role.model, role.effort],
      command: name,
    }),
    name,
    readOutput: result => result.stdout,
    title: name,
  }
}
