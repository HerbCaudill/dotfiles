import { constants as fsConstants } from "node:fs"
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { createServer, type Socket } from "node:net"
import { homedir, tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { classifierOutputJsonSchema } from "./classifierOutputJsonSchema.ts"
import { MAX_CLASSIFIER_INPUT_BYTES } from "./constants.ts"
import { parseClassifierInput } from "./parseClassifierInput.ts"
import { parseClassifierOutput } from "./parseClassifierOutput.ts"
import { runBoundedProcess } from "./runBoundedProcess.ts"
import type { ProcessRequest, ProcessResult, ProcessRunner } from "./runBoundedProcess.ts"
import type { ClassifierInput, ClassifierOutput } from "./types.ts"
import { downgradeIneligibleActions, validateClassifications } from "./validateClassifications.ts"

/** Classify normalized candidates through a fail-closed isolated Codex CLI process. */
export async function classifyWithCodex(
  /** Normalized candidates whose email content remains inert JSON data. */
  inputValue: ClassifierInput,
  /** Optional operational limits and test boundaries. */
  options: CodexClassifierOptions = {},
): Promise<ClassifierOutput> {
  const maxInputBytes = options.maxInputBytes ?? MAX_CLASSIFIER_INPUT_BYTES
  const serializedInput = JSON.stringify(inputValue)
  if (Buffer.byteLength(serializedInput, "utf8") > maxInputBytes) {
    throw new Error(`Classifier input limit of ${maxInputBytes} bytes exceeded`)
  }
  const input = parseClassifierInput(JSON.parse(serializedInput))
  const classifierPrompt = await readFile(CLASSIFIER_PROMPT_PATH, "utf8")
  const parentEnvironment = options.parentEnvironment ?? process.env
  const externalSandbox =
    parentEnvironment.EMAIL_PROCESSING_EXTERNAL_SANDBOX === EXTERNAL_SANDBOX_CLOUDFLARE
  const commandCandidates = options.codexCommand
    ? [options.codexCommand]
    : await findCodexCommands(parentEnvironment.PATH)
  if (commandCandidates.some(command => command.length === 0 || !command[0])) {
    throw new Error("Codex command must not be empty")
  }

  const authFilePath =
    options.authFilePath ??
    join(parentEnvironment.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json")
  await assertPrivateAuthFile(authFilePath)

  const isolatedRoot = await mkdtemp(join(tmpdir(), "email-classifier-"))
  try {
    const isolatedHome = join(isolatedRoot, "codex-home")
    const workspace = join(isolatedRoot, "workspace")
    const isolatedAuthPath = join(isolatedHome, "auth.json")
    const configPath = join(isolatedHome, `${CODEX_PROFILE_NAME}.config.toml`)
    const outputSchemaPath = join(isolatedHome, "classifier-output.schema.json")
    await mkdir(isolatedHome, { mode: 0o700 })
    await mkdir(workspace, { mode: 0o700 })
    await copyFile(authFilePath, isolatedAuthPath)
    await chmod(isolatedAuthPath, 0o600)
    await writeFile(configPath, createClassifierConfig(classifierPrompt), {
      encoding: "utf8",
      mode: 0o600,
    })
    await writeFile(outputSchemaPath, JSON.stringify(classifierOutputJsonSchema), {
      encoding: "utf8",
      mode: 0o600,
    })

    const env = createIsolatedEnvironment(parentEnvironment, isolatedHome, isolatedRoot)
    const runProcess = options.runProcess ?? runBoundedProcess
    const command = await proveCodexIsolation({
      authFilePath,
      commandCandidates,
      env,
      externalSandbox,
      runProcess,
      workspace,
    })

    const result = await runProcess({
      command: command[0],
      args: [
        ...command.slice(1),
        "-p",
        CODEX_PROFILE_NAME,
        "-a",
        "never",
        "--strict-config",
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--ignore-rules",
        "--color",
        "never",
        "-C",
        workspace,
        "--output-schema",
        outputSchemaPath,
        "-",
      ],
      cwd: workspace,
      env,
      stdin: serializedInput,
      timeoutMs: options.timeoutMs ?? CLASSIFIER_TIMEOUT_MS,
      maxOutputBytes: options.maxOutputBytes ?? MAX_CLASSIFIER_OUTPUT_BYTES,
    })
    if (result.code !== 0) {
      throw new Error(`Codex classifier exited with code ${result.code}`)
    }

    const output = downgradeIneligibleActions(input, parseCodexJson(result.stdout))
    validateClassifications(input, output)
    return output
  } finally {
    await rm(isolatedRoot, { force: true, recursive: true })
  }
}

/** Build the isolated Codex configuration around the source-controlled classifier prompt. */
function createClassifierConfig(
  /** Complete classifier instructions loaded from the adjacent Markdown file. */
  classifierPrompt: string,
): string {
  return `
approval_policy = "never"
allow_login_shell = false
default_permissions = "email-classifier"
web_search = "disabled"
project_doc_max_bytes = 0
include_permissions_instructions = true
include_apps_instructions = false
include_collaboration_mode_instructions = false
include_environment_context = false
developer_instructions = ${JSON.stringify(classifierPrompt.trim())}

[shell_environment_policy]
inherit = "none"
ignore_default_excludes = false

[tools.experimental_request_user_input]
enabled = false

[tools.update_plan]
enabled = false

[permissions.email-classifier]
description = "Email classification with no user-file, workspace-write, or network authority."

[permissions.email-classifier.filesystem]
":minimal" = "read"

[permissions.email-classifier.network]
enabled = false

[orchestrator.skills]
enabled = false

[orchestrator.mcp]
enabled = false

[features]
apps = false
browser_use = false
computer_use = false
goals = false
hooks = false
image_generation = false
in_app_browser = false
multi_agent = false
multi_agent_v2 = false
plugins = false
secret_auth_storage = false
shell_tool = false
skill_search = false
tool_suggest = false
view_image = false
workspace_dependencies = false
`.trimStart()
}

/** Refuse any auth source that is absent, non-regular, or accessible by another user. */
async function assertPrivateAuthFile(
  /** Source ChatGPT auth file. */
  authFilePath: string,
): Promise<void> {
  const metadata = await stat(authFilePath)
  if (!metadata.isFile()) throw new Error("Codex auth path must name a regular file")
  if ((metadata.mode & 0o077) !== 0) throw new Error("Codex auth file must be private")
}

/** Prove the installed CLI supports the required profile and enforces its restrictions. */
async function proveCodexIsolation(
  /** Startup-probe dependencies. */
  context: IsolationProbeContext,
): Promise<readonly string[]> {
  let foundUnsupportedVersion = false
  let command: readonly string[] | undefined
  for (const candidate of context.commandCandidates) {
    const version = await runStartupProbe(
      "version",
      context.runProcess,
      createProbeRequest(context, candidate, [...candidate.slice(1), "--version"]),
    )
    if (version.code !== 0) continue
    const parsedVersion = parseCodexVersion(version.stdout)
    if (compareVersions(parsedVersion, MINIMUM_CODEX_VERSION) < 0) {
      foundUnsupportedVersion = true
      continue
    }
    command = candidate
    break
  }
  if (!command && foundUnsupportedVersion) {
    throw new Error(`Codex CLI ${MINIMUM_CODEX_VERSION.join(".")} or newer is required`)
  }
  if (!command) throw new Error("Unable to determine the Codex CLI version")

  const login = await runStartupProbe(
    "login status",
    context.runProcess,
    createProbeRequest(context, command, [...command.slice(1), "login", "status"]),
  )
  if (login.code !== 0 || !`${login.stdout}\n${login.stderr}`.includes("Logged in using ChatGPT")) {
    throw new Error("Codex classifier requires ChatGPT authentication")
  }

  if (!context.externalSandbox) {
    const isolation = await runIsolationProbe(context, command)
    if (isolation.code !== 0) {
      throw new Error(`Codex isolation probe failed with code ${isolation.code}`)
    }
  }
  return command
}

/** Add the failing stage to bounded startup-process errors. */
async function runStartupProbe(
  /** Human-readable startup stage. */
  stage: string,
  /** Bounded process runner. */
  runProcess: ProcessRunner,
  /** Exact startup request. */
  request: ProcessRequest,
): Promise<ProcessResult> {
  try {
    return await runProcess(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Codex ${stage} probe failed: ${message}`, { cause: error })
  }
}

/** Attempt forbidden read, write, and network operations under the selected profile. */
async function runIsolationProbe(
  /** Shared startup-probe context. */
  context: IsolationProbeContext,
  /** Selected Codex executable plus any fixed wrapper arguments. */
  command: readonly string[],
): Promise<ProcessResult> {
  let networkReachedSupervisor = false
  const sockets = new Set<Socket>()
  const server = createServer(socket => {
    networkReachedSupervisor = true
    sockets.add(socket)
    socket.once("close", () => sockets.delete(socket))
    socket.end("HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n")
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    server.close()
    throw new Error("Unable to start the Codex network isolation probe")
  }

  try {
    const writeProbePath = join(context.workspace, "write-probe")
    const result = await context.runProcess(
      createProbeRequest(context, command, [
        ...command.slice(1),
        "-p",
        CODEX_PROFILE_NAME,
        "sandbox",
        "-P",
        CODEX_PROFILE_NAME,
        "-C",
        context.workspace,
        "--",
        "/bin/sh",
        "-c",
        ISOLATION_PROBE_SCRIPT,
        "email-classifier-probe",
        context.authFilePath,
        writeProbePath,
        `http://127.0.0.1:${address.port}/`,
      ]),
    )
    if (networkReachedSupervisor) {
      throw new Error("Codex isolation probe reached the network")
    }
    return result
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()))
      sockets.forEach(socket => socket.destroy())
    })
  }
}

/** Create one small startup-probe process request. */
function createProbeRequest(
  /** Shared startup-probe context. */
  context: IsolationProbeContext,
  /** Selected Codex executable plus any fixed wrapper arguments. */
  command: readonly string[],
  /** Exact Codex argument vector. */
  args: readonly string[],
): ProcessRequest {
  return {
    command: command[0],
    args,
    cwd: context.workspace,
    env: context.env,
    stdin: "",
    timeoutMs: STARTUP_PROBE_TIMEOUT_MS,
    maxOutputBytes: MAX_STARTUP_OUTPUT_BYTES,
  }
}

/** Find executable Codex candidates in parent PATH order. */
async function findCodexCommands(
  /** Parent executable search path. */
  pathValue: string | undefined,
): Promise<readonly (readonly string[])[]> {
  const candidates = (pathValue ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map(directory => join(directory, process.platform === "win32" ? "codex.exe" : "codex"))
  const executableCandidates: string[] = []
  for (const candidate of candidates) {
    if (executableCandidates.includes(candidate)) continue
    try {
      await access(candidate, fsConstants.X_OK)
      executableCandidates.push(candidate)
    } catch {
      // Continue to the next PATH entry when this candidate is absent or not executable.
    }
  }
  if (executableCandidates.length === 0) return [["codex"]]
  return executableCandidates.map(candidate => [candidate])
}

/** Parse the version emitted by `codex --version`. */
function parseCodexVersion(
  /** Bounded version output. */
  output: string,
): readonly [number, number, number] {
  const match = output.match(/\bcodex-cli (\d+)\.(\d+)\.(\d+)\b/)
  if (!match) throw new Error("Unable to parse the Codex CLI version")
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Compare two three-part versions. */
function compareVersions(
  /** Installed version. */
  installed: readonly number[],
  /** Required version. */
  required: readonly number[],
): number {
  for (let index = 0; index < required.length; index += 1) {
    const difference = installed[index] - required[index]
    if (difference !== 0) return difference
  }
  return 0
}

/** Parse and schema-check the classifier's only accepted output. */
function parseCodexJson(
  /** Bounded Codex standard output. */
  stdout: string,
): ClassifierOutput {
  let value: unknown
  try {
    value = JSON.parse(stdout)
  } catch {
    throw new Error("Codex classifier did not return valid JSON")
  }
  return parseClassifierOutput(value)
}

/** Construct the complete allowlisted child environment. */
function createIsolatedEnvironment(
  /** Parent environment from which only transport-safe values may be copied. */
  parent: NodeJS.ProcessEnv,
  /** Temporary Codex home containing only ChatGPT auth and classifier policy. */
  isolatedHome: string,
  /** Private temporary root. */
  isolatedRoot: string,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    CODEX_HOME: isolatedHome,
    HOME: isolatedHome,
    TMPDIR: isolatedRoot,
  }
  for (const name of ALLOWED_PARENT_ENVIRONMENT_VARIABLES) {
    if (parent[name] !== undefined) env[name] = parent[name]
  }
  return env
}

// CONSTANTS

const CODEX_PROFILE_NAME = "email-classifier"
const CLASSIFIER_PROMPT_PATH = new URL("./classifier.prompt.md", import.meta.url)
const EXTERNAL_SANDBOX_CLOUDFLARE = "cloudflare"
const MINIMUM_CODEX_VERSION = [0, 149, 1] as const
// Codex mirrors stdin to diagnostic output, so this cap includes the bounded input plus its result.
const MAX_CLASSIFIER_OUTPUT_BYTES = MAX_CLASSIFIER_INPUT_BYTES + 262_144
const MAX_STARTUP_OUTPUT_BYTES = 16_384
const CLASSIFIER_TIMEOUT_MS = 120_000
const STARTUP_PROBE_TIMEOUT_MS = 30_000
const ALLOWED_PARENT_ENVIRONMENT_VARIABLES = [
  "ALL_PROXY",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "NO_PROXY",
  "PATH",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
] as const

const ISOLATION_PROBE_SCRIPT = `
if : < "$1" 2>/dev/null; then exit 11; fi
if printf probe > "$2" 2>/dev/null; then exit 12; fi
if ! /usr/bin/curl --version >/dev/null 2>&1; then exit 14; fi
if /usr/bin/curl --connect-timeout 2 --max-time 3 "$3" >/dev/null 2>&1; then exit 13; fi
exit 0
`.trim()

// TYPES

/** Optional limits and boundaries for the isolated classifier. */
export type CodexClassifierOptions = {
  /** Codex executable plus any fixed wrapper arguments. */
  codexCommand?: readonly string[]
  /** Source ChatGPT auth file copied into the temporary Codex home. */
  authFilePath?: string
  /** Maximum serialized classifier input bytes. */
  maxInputBytes?: number
  /** Maximum classifier wall-clock duration. */
  timeoutMs?: number
  /** Maximum combined classifier stdout and stderr bytes. */
  maxOutputBytes?: number
  /** Parent environment filtered through the fixed transport allowlist. */
  parentEnvironment?: NodeJS.ProcessEnv
  /** Injectable bounded-process boundary. */
  runProcess?: ProcessRunner
}

type IsolationProbeContext = {
  /** Original auth file that the sandbox must not read. */
  authFilePath: string
  /** Codex executables plus any fixed wrapper arguments, in preference order. */
  commandCandidates: readonly (readonly string[])[]
  /** Complete isolated process environment. */
  env: NodeJS.ProcessEnv
  /** Whether Cloudflare enforces the outer process and network boundary. */
  externalSandbox: boolean
  /** Bounded process boundary. */
  runProcess: ProcessRunner
  /** Empty, non-writable model workspace. */
  workspace: string
}
