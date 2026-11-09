import { readFileSync } from "node:fs"
import { resolve as resolvePath } from "node:path"
import { parseArgs } from "node:util"
import { INSTRUCTIONS_PATH } from "./constants.ts"
import { executeInvocation } from "./executeInvocation.ts"
import { HARNESSES } from "./harnesses.ts"
import { parseRoles } from "./parseRoles.ts"
import { resolveRole } from "./resolveRole.ts"
import { runLlm } from "./runLlm.ts"
import type { Role, Sandbox } from "./types.ts"

/** Run the `llm` command line. */
async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === "run") return run(args)
  if (command === "resolve") return resolve(args)
  if (command === "roles") return printRoles()
  console.error(USAGE)
  process.exitCode = 2
}

/** Run a prompt from standard input and print the final message. */
async function run(
  /** Command line arguments. */
  args: string[],
) {
  const { values } = parseArgs({
    args,
    options: {
      cwd: { type: "string" },
      image: { multiple: true, type: "string" },
      role: { type: "string" },
      sandbox: { type: "string" },
      schema: { type: "string" },
      timeout: { type: "string" },
    },
  })
  const { output, role } = await runLlm(
    {
      cwd: values.cwd,
      images: values.image?.map(path => resolvePath(path)),
      prompt: readFileSync(0, "utf8"),
      role: readRoleName(values.role),
      sandbox: (values.sandbox ?? "read-only") as Sandbox,
      schemaPath: values.schema,
      timeoutMs: values.timeout ? Number(values.timeout) : undefined,
    },
    { execute: executeInvocation, harnesses: HARNESSES, roles: readRoles() },
  )
  console.error(`llm ${describeRole(role)}`)
  process.stdout.write(output)
}

/** Print a role's harness, model and effort as JSON. */
function resolve(
  /** Command line arguments. */
  args: string[],
) {
  const { values } = parseArgs({ args, options: { role: { type: "string" } } })
  console.log(JSON.stringify(resolveRole(readRoles(), readRoleName(values.role))))
}

/** Print every role. */
function printRoles() {
  for (const role of readRoles()) console.log(describeRole(role))
}

/** Read the model roles table from the global agent instructions. */
function readRoles(): Role[] {
  return parseRoles(readFileSync(INSTRUCTIONS_PATH, "utf8"))
}

/** Check that a role was given. */
function readRoleName(
  /** The raw argument. */
  value: string | undefined,
): string {
  if (value === undefined) throw new Error("--role is required")
  return value
}

/** Format a role for logs. */
function describeRole(
  /** The role to describe. */
  role: Role,
): string {
  return `${role.name}: ${role.harness} ${role.model} ${role.effort}`
}

const USAGE = `Usage:
  llm run --role <name> [--image file]... [--sandbox mode] [--schema file] [--cwd dir] [--timeout ms] < prompt
  llm resolve --role <name>
  llm roles`

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
