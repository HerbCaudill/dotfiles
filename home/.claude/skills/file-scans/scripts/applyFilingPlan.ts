import { execFile } from "node:child_process"
import { access, appendFile, mkdir, readFile, rename, unlink } from "node:fs/promises"
import { dirname, join } from "node:path"
import { promisify } from "node:util"

/**
 * Apply an approved filing plan to the scans folder. Every entry is validated before any file
 * changes, so a bad plan leaves the folder untouched. Merged sources are deleted, which sends them
 * to Google Drive's trash.
 */
export async function applyFilingPlan(
  /** Absolute path of the scans folder; plan paths are relative to it. */
  root: string,
  /** Approved entries, each filing one or more scans as a single PDF. */
  plan: FilingEntry[],
  /** PDF tools, replaceable in tests. */
  tools: PdfTools = popplerTools,
) {
  await validatePlan(root, plan)

  for (const { sources, target } of plan) {
    const sourcePaths = sources.map(source => join(root, source))
    const targetPath = join(root, target)
    await mkdir(dirname(targetPath), { recursive: true })

    if (sourcePaths.length === 1) {
      await rename(sourcePaths[0], targetPath)
    } else {
      await tools.mergePdfs(sourcePaths, targetPath)
      const expected = (await Promise.all(sourcePaths.map(tools.countPages))).reduce(
        (a, b) => a + b,
      )
      const actual = await tools.countPages(targetPath)
      // Keep the originals if the merge lost pages
      if (actual !== expected)
        throw new Error(`Merged ${target} has ${actual} pages; expected ${expected}`)
      await Promise.all(sourcePaths.map(path => unlink(path)))
    }

    const logEntry = { at: new Date().toISOString(), sources, target }
    await appendFile(join(root, LOG_FILE), JSON.stringify(logEntry) + "\n")
  }
}

/** Throw if any source is missing or any target is invalid, taken, or duplicated. */
async function validatePlan(
  /** Absolute path of the scans folder. */
  root: string,
  /** Entries to check. */
  plan: FilingEntry[],
) {
  const problems: string[] = []
  const targets = new Set<string>()

  for (const { sources, target } of plan) {
    if (sources.length === 0) problems.push(`${target}: no sources`)
    if (!target.toLowerCase().endsWith(".pdf")) problems.push(`${target}: not a .pdf name`)
    if (targets.has(target)) problems.push(`${target}: used twice in plan`)
    targets.add(target)
    if (await exists(join(root, target))) problems.push(`${target}: already exists`)
    for (const source of sources)
      if (!(await exists(join(root, source)))) problems.push(`${source}: source not found`)
  }

  if (problems.length) throw new Error(`Plan not applied:\n${problems.join("\n")}`)
}

/** Whether a path exists. */
async function exists(
  /** Absolute path. */
  path: string,
) {
  return access(path).then(
    () => true,
    () => false,
  )
}

// CONSTANTS

/** Append-only record of applied entries, kept in the scans folder. */
const LOG_FILE = ".filing-log.jsonl"

const run = promisify(execFile)

/** PDF tools backed by Poppler's command-line utilities. */
const popplerTools: PdfTools = {
  /** Combine sources in order with pdfunite. */
  mergePdfs: async (
    /** Absolute source paths in page order. */
    sources,
    /** Absolute output path. */
    target,
  ) => {
    await run("pdfunite", [...sources, target])
  },
  /** Read the page count from pdfinfo. */
  countPages: async (
    /** Absolute PDF path. */
    path,
  ) => {
    const { stdout } = await run("pdfinfo", [path])
    return Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1])
  },
}

// TYPES

/** One output PDF and the scans it is made from. */
export type FilingEntry = {
  /** Source paths relative to the scans folder, in page order. */
  sources: string[]
  /** Destination path relative to the scans folder. */
  target: string
}

/** Operations on PDF files. */
type PdfTools = {
  /** Write the concatenation of the sources to the target. */
  mergePdfs: (sources: string[], target: string) => Promise<void>
  /** Count a PDF's pages. */
  countPages: (path: string) => Promise<number>
}

// CLI: node applyFilingPlan.ts <scans folder> <plan.json>
if (import.meta.main) {
  const [root, planPath] = process.argv.slice(2)
  if (!root || !planPath) {
    console.error("Usage: node applyFilingPlan.ts <scans folder> <plan.json>")
    process.exit(1)
  }
  const plan = JSON.parse(await readFile(planPath, "utf8")) as FilingEntry[]
  await applyFilingPlan(root, plan)
  console.log(`Filed ${plan.length} documents`)
}
