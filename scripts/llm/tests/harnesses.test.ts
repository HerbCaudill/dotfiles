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
