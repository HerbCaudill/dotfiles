import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

/**
 * Create the email job's narrow client for Herb's Tasks board: capture an Inbox item, write its
 * description and complete it. Every write keeps its request ID so a lost reply can be inspected
 * and retried under the Tasks receipt rules instead of creating a duplicate.
 */
export function createEmailTasksClient(
  /** Injectable process runner and space binding. */
  options: EmailTasksClientOptions = {},
): EmailTasksClient {
  const run = options.run ?? runTasksCli
  const spaceId = options.spaceId ?? process.env.TASKS_SPACE_ID ?? TASKS_SPACE_ID

  /** Run one command and check the response belongs to the enrolled space. */
  const call = async (command: string, input: Record<string, unknown>, requestId?: string) => {
    const args = [
      command,
      "--timezone",
      "Europe/Madrid",
      "--input",
      "-",
      ...(requestId ? ["--request-id", requestId] : []),
    ]
    const { code, stdout } = await run(args, `${JSON.stringify(input)}\n`)
    const response = JSON.parse(stdout) as TasksResponse
    if (!Object.hasOwn(EXIT_CODES, response.status) || code !== EXIT_CODES[response.status]) {
      throw new Error("Tasks response and process exit disagree")
    }
    if (response.metadata?.spaceId && response.metadata.spaceId !== spaceId) {
      throw new Error("Tasks response came from an unexpected space")
    }
    return response
  }

  /** Write once, resolving an unconfirmed reply through inspect and retry. */
  const write = async (command: string, input: Record<string, unknown>, requestId: string) => {
    let response = await call(command, input, requestId)
    if (response.status === "unconfirmed") {
      const inspected = await call("inspect", {}, requestId)
      if (inspected.receipt?.request?.requestId !== requestId) {
        throw new Error("Tasks unconfirmed: original receipt is unavailable")
      }
      response = await call("retry", {}, requestId)
    }
    if (response.status !== "saved") throw new Error(`Tasks ${command} returned ${response.status}`)
    return response.result ?? {}
  }

  return {
    capture: async (title, eventKey, requestId) => {
      const result = await write("capture", { title, eventKey }, requestId)
      const id = result.createdIds?.length === 1 ? result.createdIds[0] : undefined
      if (!id) throw new Error("Tasks capture did not return one task ID")
      return id
    },
    saveDescription: async (taskId, text, requestId) => {
      await write(
        "save-description",
        {
          target: "task",
          id: taskId,
          editorId: "email-processing",
          submissionId: requestId,
          base: "",
          text,
        },
        requestId,
      )
    },
    complete: async (taskId, requestId) => {
      await write("complete", { taskId }, requestId)
    },
  }
}

/** Run the Tasks CLI. On Windows the launcher is a .cmd shim, so run its Node entry directly. */
async function runTasksCli(
  /** Command and literal options. */
  args: string[],
  /** JSON request written to stdin. */
  input: string,
): Promise<{ code: number | null; stdout: string }> {
  const [command, commandArgs] =
    process.platform === "win32" ? [process.execPath, [WINDOWS_CLI, ...args]] : ["tasks", args]
  const child = spawn(command, commandArgs, {
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  })
  const closed = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", resolve)
  })
  let stdout = ""
  child.stdout.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => (stdout += chunk))
  child.stdin.on("error", () => {})
  child.stdin.end(input)
  const timeout = setTimeout(() => child.kill(), 80_000)
  try {
    return { code: await closed, stdout }
  } finally {
    clearTimeout(timeout)
  }
}

// CONSTANTS

/** Herb's enrolled Tasks space, as named in the tasks skill. */
const TASKS_SPACE_ID = "B7CSO2L6KYNN4HZBSBNHP3LC3SA7PYNJO"

const WINDOWS_CLI = fileURLToPath(new URL("../tasks-agent/windowsCli.ts", import.meta.url))

const EXIT_CODES: Record<string, number> = {
  ok: 0,
  saved: 0,
  invalid: 2,
  conflict: 3,
  unavailable: 4,
  unconfirmed: 5,
}

// TYPES

/** The writes the email job makes to Herb's Tasks board. */
export type EmailTasksClient = {
  /** Capture an Inbox item and return its task ID. */
  capture: (title: string, eventKey: string, requestId: string) => Promise<string>
  /** Write the description of a task the job captured. */
  saveDescription: (taskId: string, text: string, requestId: string) => Promise<void>
  /** Complete a task. */
  complete: (taskId: string, requestId: string) => Promise<void>
}

/** Runs the Tasks CLI with literal arguments and JSON on stdin. */
export type TasksRunner = (
  args: string[],
  input: string,
) => Promise<{ code: number | null; stdout: string }>

/** Options for the Tasks client. */
export type EmailTasksClientOptions = {
  /** Process runner, replaceable in tests. */
  run?: TasksRunner
  /** Expected space ID. */
  spaceId?: string
}

/** The parts of a Tasks CLI response the job reads. */
type TasksResponse = {
  status: string
  result?: { createdIds?: string[]; affectedIds?: string[] }
  receipt?: { request?: { requestId?: string } }
  metadata?: { spaceId?: string }
}
