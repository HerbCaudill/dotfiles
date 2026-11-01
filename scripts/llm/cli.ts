import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { API_KEY_PATH, SNAPSHOT_PATH, TEST_TIMEOUT_MS } from "./constants.ts"
import { executeInvocation } from "./executeInvocation.ts"
import { fetchModels } from "./fetchModels.ts"
import { getFrontier } from "./getFrontier.ts"
import { HARNESSES } from "./harnesses.ts"
import { isFailedResult } from "./isFailedResult.ts"
import { isUsageLimitFailure } from "./isUsageLimitFailure.ts"
import { parseModels } from "./parseModels.ts"
import { readSnapshot } from "./readSnapshot.ts"
import { refreshFrontier } from "./refreshFrontier.ts"
import { resolveVariant } from "./resolveVariant.ts"
import { runLlm } from "./runLlm.ts"
import type { Sandbox, Snapshot, Variant } from "./types.ts"

/** Run the `llm` command line. */
async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === "run") return run(args)
  if (command === "resolve") return resolve(args)
  if (command === "refresh") return refresh()
  if (command === "frontier") return printFrontier()
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
      harness: { type: "string" },
      level: { type: "string" },
      sandbox: { type: "string" },
      schema: { type: "string" },
      timeout: { type: "string" },
    },
  })
  const { output, variant } = await runLlm(
    {
      cwd: values.cwd,
      harness: values.harness,
      level: readLevel(values.level),
      prompt: readFileSync(0, "utf8"),
      sandbox: (values.sandbox ?? "read-only") as Sandbox,
      schemaPath: values.schema,
      timeoutMs: values.timeout ? Number(values.timeout) : undefined,
    },
    {
      execute: executeInvocation,
      harnesses: HARNESSES,
      log: console.error,
      snapshot: readSnapshot(),
    },
  )
  console.error(`llm level=${values.level} ${describeVariant(variant)}`)
  process.stdout.write(output)
}

/** Print the variant a level resolves to as JSON. */
function resolve(
  /** Command line arguments. */
  args: string[],
) {
  const { values } = parseArgs({
    args,
    options: { harness: { type: "string" }, level: { type: "string" } },
  })
  const variant = resolveVariant(readSnapshot(), {
    harness: values.harness,
    level: readLevel(values.level),
  })
  console.log(JSON.stringify(variant))
}

/** Fetch new scores, test any new picks and save the result. */
async function refresh() {
  const { indexVersion, models } = await fetchModels(readFileSync(API_KEY_PATH, "utf8").trim())
  const harnesses = Object.values(HARNESSES)
  const variants = parseModels(models, baseSlug =>
    harnesses.flatMap(harness =>
      harness.getModels(baseSlug).map(model => ({ harness: harness.name, model })),
    ),
  )
  const previous = existsSync(SNAPSHOT_PATH) ? readSnapshot() : undefined
  const snapshot = await refreshFrontier({
    fetchedAt: new Date().toISOString(),
    indexVersion,
    log: console.log,
    previous,
    test: testVariant,
    variants,
  })
  writeSnapshot(snapshot)
  printSnapshotChange(previous, snapshot)
}

/** Print the current frontier. */
function printFrontier() {
  const snapshot = readSnapshot()
  console.log(`Floor ${snapshot.floor}, index v${snapshot.indexVersion}, ${snapshot.fetchedAt}`)
  for (const variant of getFrontier(snapshot.variants)) console.log(describeVariant(variant))
}

/** Make a small real call to confirm a variant works. */
async function testVariant(
  /** The variant to test. */
  variant: Variant,
): Promise<"passed" | "failed" | "limited"> {
  const prompt = readFileSync(join(import.meta.dirname, "test.prompt.md"), "utf8")
  const invocation = HARNESSES[variant.harness]!.getInvocation(
    { level: 0, prompt, sandbox: "read-only" },
    variant,
  )
  const result = await executeInvocation(invocation, {
    cwd: mkdtempSync(join(tmpdir(), "llm-test-")),
    prompt,
    timeoutMs: TEST_TIMEOUT_MS,
  })
  if (!isFailedResult(result)) return "passed"
  return isUsageLimitFailure(result) ? "limited" : "failed"
}

/** Log which picks moved, so a later change in behavior can be traced. */
function printSnapshotChange(
  /** The snapshot that was replaced. */
  previous: Snapshot | undefined,
  /** The new snapshot. */
  snapshot: Snapshot,
) {
  const before = new Set(previous ? getFrontier(previous.variants).map(describeVariant) : [])
  const after = getFrontier(snapshot.variants).map(describeVariant)
  const added = after.filter(variant => !before.has(variant))
  console.log(
    `${snapshot.fetchedAt} refreshed: ${snapshot.variants.length} variants, ${after.length} on frontier, floor ${snapshot.floor}`,
  )
  for (const variant of added) console.log(`  new: ${variant}`)
}

/** Read and check a level argument. */
function readLevel(
  /** The raw argument. */
  value: string | undefined,
): number {
  if (value === undefined) throw new Error("--level is required")
  return Number(value)
}

/** Save the snapshot atomically, so that a running job never reads a partial file. */
function writeSnapshot(
  /** The snapshot to save. */
  snapshot: Snapshot,
) {
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true })
  const temporaryPath = `${SNAPSHOT_PATH}.${process.pid}.tmp`
  writeFileSync(temporaryPath, JSON.stringify(snapshot, null, 2))
  renameSync(temporaryPath, SNAPSHOT_PATH)
}

/** Format a variant for logs. */
function describeVariant(
  /** The variant to describe. */
  variant: Variant,
): string {
  return `${variant.harness} ${variant.model} ${variant.effort} (intelligence ${variant.intelligence}, $${variant.costPerTask}/task)`
}

const USAGE = `Usage:
  llm run --level <0-100> [--harness name] [--sandbox mode] [--schema file] [--cwd dir] [--timeout ms] < prompt
  llm resolve --level <0-100> [--harness name]
  llm frontier
  llm refresh`

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
