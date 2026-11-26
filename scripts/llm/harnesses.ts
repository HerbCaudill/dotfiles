import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import type { Harness, RunRequest } from "./types.ts"

/** Run requests through `codex exec`. */
const codex: Harness = {
  getInvocation: (request, role) => {
    const outputPath = join(mkdtempSync(join(tmpdir(), "llm-codex-")), "output.txt")
    return {
      args: [
        "exec",
        "--model",
        role.model,
        "--config",
        `model_reasoning_effort="${role.effort}"`,
        "--sandbox",
        request.sandbox,
        "--skip-git-repo-check",
        "--ephemeral",
        ...(request.schemaPath ? ["--output-schema", request.schemaPath] : []),
        ...(request.images ?? []).flatMap(path => ["--image", path]),
        "--output-last-message",
        outputPath,
        "-",
      ],
      command: process.env.LLM_CODEX_COMMAND ?? "codex",
      outputPath,
    }
  },
  name: "codex",
  readOutput: (_result, invocation) => readFileSync(invocation.outputPath!, "utf8"),
  title: "Codex",
}

/** Run requests through `claude -p`. */
const claude: Harness = {
  getInvocation: (request, role) => {
    const images = request.images ?? []
    return {
      args: [
        "-p",
        "--model",
        role.model,
        "--effort",
        role.effort,
        "--output-format",
        "json",
        // Headless jobs don't use the MCP servers, and loading them costs a lot of context.
        "--strict-mcp-config",
        ...getClaudeSandboxArgs(request),
        ...[...new Set(images.map(path => dirname(path)))].flatMap(dir => ["--add-dir", dir]),
        ...(request.schemaPath ? ["--json-schema", readFileSync(request.schemaPath, "utf8")] : []),
      ],
      command: process.env.LLM_CLAUDE_COMMAND ?? "claude",
      // `claude -p` has no image flag, so the model reads each image with its Read tool.
      input:
        images.length === 0
          ? undefined
          : `${request.prompt}\n\nAttached images. Read each one with the Read tool before you answer:\n${images.map(path => `- ${path}`).join("\n")}`,
    }
  },
  name: "claude",
  readOutput: result => {
    const { result: text, structured_output: structuredOutput } = JSON.parse(result.stdout)
    return structuredOutput === undefined ? text : JSON.stringify(structuredOutput)
  },
  title: "Claude Code",
}

/**
 * Run requests through Antigravity's `agy`. The prompt goes in as a stream-json message on
 * standard input because a long prompt can exceed the Windows command line limit.
 */
const antigravity: Harness = {
  getInvocation: (request, role) => {
    const images = request.images ?? []
    const prompt =
      images.length === 0
        ? request.prompt
        : `${request.prompt}\n\nAttached images. Look at each one before you answer:\n${images.map(path => `- ${path}`).join("\n")}`
    return {
      args: [
        "--model",
        role.model,
        "--effort",
        role.effort,
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        ...getAntigravitySandboxArgs(request),
        ...[...new Set(images.map(path => dirname(path)))].flatMap(dir => ["--add-dir", dir]),
        ...(request.schemaPath ? ["--json-schema", request.schemaPath] : []),
      ],
      command: process.env.LLM_ANTIGRAVITY_COMMAND ?? "agy",
      input: `${JSON.stringify({ event: "user", message: { content: prompt } })}\n`,
    }
  },
  name: "antigravity",
  readOutput: result => {
    const event = result.stdout
      .split("\n")
      .filter(line => line.startsWith("{"))
      .map(line => JSON.parse(line))
      .findLast(event => event.event === "result")
    if (!event) throw new Error(`Antigravity returned no result: ${result.stderr.trim()}`)
    const { error, response, status, structured_output: structuredOutput } = event.result
    if (status !== "SUCCESS") throw new Error(`Antigravity failed: ${error ?? status}`)
    return structuredOutput === undefined ? response : JSON.stringify(structuredOutput)
  },
  title: "Antigravity",
}

/** Every harness the CLI can use. To add one, write an adapter and list it here. */
export const HARNESSES: Record<string, Harness> = { antigravity, claude, codex }

/**
 * Translate a sandbox setting into Antigravity's flags. Its headless default lets the agent
 * write files, so read-only runs deny every action except reading.
 */
function getAntigravitySandboxArgs(
  /** The request being run. */
  request: RunRequest,
): string[] {
  if (request.sandbox === "danger-full-access") return ["--dangerously-skip-permissions"]
  if (request.sandbox === "workspace-write") return ["--mode", "accept-edits", "--sandbox"]
  const deny = ["write_file", "command", "execute_url", "download_url", "mcp", "unsandboxed"]
  return ["--settings", JSON.stringify({ permissions: { deny: deny.map(a => `${a}(*)`) } })]
}

/** Translate a sandbox setting into Claude's tool and permission flags. */
function getClaudeSandboxArgs(
  /** The request being run. */
  request: RunRequest,
): string[] {
  if (request.sandbox === "danger-full-access") return ["--dangerously-skip-permissions"]
  if (request.sandbox === "workspace-write") return ["--permission-mode", "acceptEdits"]
  return ["--tools", "Read,Grep,Glob"]
}
