import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import type { Harness, RunRequest } from "./types.ts"

/** Run requests through `codex exec`. */
const codex: Harness = {
  getInvocation: (request, variant) => {
    const outputPath = join(mkdtempSync(join(tmpdir(), "llm-codex-")), "output.txt")
    return {
      args: [
        "exec",
        "--model",
        variant.model,
        "--config",
        `model_reasoning_effort="${variant.effort}"`,
        "--sandbox",
        request.sandbox,
        "--skip-git-repo-check",
        "--ephemeral",
        ...(request.schemaPath ? ["--output-schema", request.schemaPath] : []),
        "--output-last-message",
        outputPath,
        "-",
      ],
      command: process.env.LLM_CODEX_COMMAND ?? "codex",
      outputPath,
    }
  },
  getModels: baseSlug => readCodexModels().filter(model => model.replaceAll(".", "-") === baseSlug),
  name: "codex",
  readOutput: (_result, invocation) => readFileSync(invocation.outputPath!, "utf8"),
}

/** Run requests through `claude -p`. */
const claude: Harness = {
  getInvocation: (request, variant) => ({
    args: [
      "-p",
      "--model",
      variant.model,
      "--effort",
      variant.effort,
      "--output-format",
      "json",
      // Headless jobs don't use the MCP servers, and loading them costs a lot of context.
      "--strict-mcp-config",
      ...getClaudeSandboxArgs(request),
      ...(request.schemaPath ? ["--json-schema", readFileSync(request.schemaPath, "utf8")] : []),
    ],
    command: process.env.LLM_CLAUDE_COMMAND ?? "claude",
  }),
  getModels: baseSlug => (baseSlug.startsWith("claude-") ? [baseSlug] : []),
  name: "claude",
  readOutput: result => {
    const { result: text, structured_output: structuredOutput } = JSON.parse(result.stdout)
    return structuredOutput === undefined ? text : JSON.stringify(structuredOutput)
  },
}

/** Every harness the CLI can use. To add one, write an adapter and list it here. */
export const HARNESSES: Record<string, Harness> = { claude, codex }

/** Translate a sandbox setting into Claude's tool and permission flags. */
function getClaudeSandboxArgs(
  /** The request being run. */
  request: RunRequest,
): string[] {
  if (request.sandbox === "danger-full-access") return ["--dangerously-skip-permissions"]
  if (request.sandbox === "workspace-write") return ["--permission-mode", "acceptEdits"]
  return ["--tools", "Read,Grep,Glob"]
}

/** Read the models Codex currently offers this account. */
function readCodexModels(): string[] {
  if (!existsSync(CODEX_MODELS_CACHE_PATH)) return []
  const { models } = JSON.parse(readFileSync(CODEX_MODELS_CACHE_PATH, "utf8")) as {
    models: { slug: string; visibility: string }[]
  }
  return models.filter(model => model.visibility === "list").map(model => model.slug)
}

const CODEX_MODELS_CACHE_PATH = join(homedir(), ".codex/models_cache.json")
