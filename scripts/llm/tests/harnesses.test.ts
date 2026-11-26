import { expect, test } from "vitest"
import { HARNESSES } from "../harnesses.ts"
import type { Role, RunRequest } from "../types.ts"

const request: RunRequest = {
  images: ["/captures/a/frame-01.png", "/captures/b/frame-02.png"],
  prompt: "Describe the frames.",
  role: "default",
  sandbox: "read-only",
}

test("Codex attaches images with --image", () => {
  const role: Role = { effort: "high", harness: "codex", model: "gpt-6.1-sol", name: "author" }
  const { args } = HARNESSES.codex!.getInvocation(request, role)
  expect(args.join(" ")).toContain(
    "--image /captures/a/frame-01.png --image /captures/b/frame-02.png",
  )
})

test("Claude gets read access to the images and their paths in the prompt", () => {
  const role: Role = {
    effort: "high",
    harness: "claude",
    model: "claude-opus-5-5",
    name: "default",
  }
  const invocation = HARNESSES.claude!.getInvocation(request, role)
  expect(invocation.args.join(" ")).toContain("--add-dir /captures/a --add-dir /captures/b")
  expect(invocation.input).toMatch(/^Describe the frames\.\n\n.*\n- \/captures\/a\/frame-01\.png/s)
})

const neon: Role = {
  effort: "high",
  harness: "antigravity",
  model: "gemini-4-neon",
  name: "writer",
}

test("Antigravity sends the prompt as one stream-json message and blocks writes when read-only", () => {
  const invocation = HARNESSES.antigravity!.getInvocation(
    { prompt: "Write it.", role: "writer", sandbox: "read-only", schemaPath: "/s.json" },
    neon,
  )
  expect(JSON.parse(invocation.input!)).toEqual({
    event: "user",
    message: { content: "Write it." },
  })
  const args = invocation.args.join(" ")
  expect(args).toContain("--model gemini-4-neon --effort high")
  expect(args).toContain("--json-schema /s.json")
  expect(args).toMatch(/--settings \{.*"deny":\[.*"write_file\(\*\)".*"command\(\*\)"/)
})

test("Antigravity returns the structured output of its result event", () => {
  const stdout = [
    { event: "init" },
    { event: "result", result: { response: "{}", status: "SUCCESS", structured_output: { a: 1 } } },
  ]
    .map(line => JSON.stringify(line))
    .join("\n")
  const output = HARNESSES.antigravity!.readOutput(
    { code: 0, stderr: "", stdout },
    { args: [], command: "agy" },
  )
  expect(output).toBe('{"a":1}')
})

test("Antigravity reports an error result as a failure", () => {
  const stdout = JSON.stringify({
    event: "result",
    result: { error: "NOT_FOUND (code 404)", response: "", status: "ERROR" },
  })
  expect(() =>
    HARNESSES.antigravity!.readOutput(
      { code: 0, stderr: "", stdout },
      { args: [], command: "agy" },
    ),
  ).toThrow(/NOT_FOUND/)
})
