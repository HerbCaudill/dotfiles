import { execFile } from "node:child_process"
import {
  access,
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { promisify } from "node:util"

/**
 * Apply an approved filing plan to the scans folder. Every entry is validated before any file
 * changes, so a bad plan leaves the folder untouched. Merged, split, and duplicate sources are
 * deleted, which sends them to Google Drive's trash.
 */
export async function applyFilingPlan(
  /** Absolute path of the scans folder; plan paths are relative to it. */
  root: string,
  /** Approved entries, each filing one or more scans as a single PDF. */
  plan: FilingEntry[],
  /** PDF tools, replaceable in tests. */
  tools: PdfTools = popplerTools,
) {
  await validatePlan(root, plan, tools)

  // Split sources are deleted once their last part has been written
  const remainingParts = new Map<string, number>()
  for (const { sources, pages } of plan)
    if (pages) remainingParts.set(sources[0], (remainingParts.get(sources[0]) ?? 0) + 1)

  for (const { sources, target, pages } of plan) {
    const sourcePaths = sources.map(source => join(root, source))

    if (target === null) {
      await unlink(sourcePaths[0])
    } else {
      const targetPath = join(root, target)
      await mkdir(dirname(targetPath), { recursive: true })

      if (pages) {
        const pageNumbers = parsePages(pages)
        await tools.extractPages(sourcePaths[0], pageNumbers, targetPath)
        const actual = await tools.countPages(targetPath)
        if (actual !== pageNumbers.length)
          throw new Error(`Split ${target} has ${actual} pages; expected ${pageNumbers.length}`)
        const left = remainingParts.get(sources[0])! - 1
        remainingParts.set(sources[0], left)
        if (left === 0) await unlink(sourcePaths[0])
      } else if (sourcePaths.length === 1) {
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
    }

    const logEntry = { at: new Date().toISOString(), sources, pages, target }
    await appendFile(join(root, LOG_FILE), JSON.stringify(logEntry) + "\n")
  }
}

/**
 * Throw if any source is missing or reused, any target is invalid, taken, or duplicated, or a
 * split leaves pages unassigned.
 */
async function validatePlan(
  /** Absolute path of the scans folder. */
  root: string,
  /** Entries to check. */
  plan: FilingEntry[],
  /** PDF tools, used to count pages of split sources. */
  tools: PdfTools,
) {
  const problems: string[] = []
  const targets = new Set<string>()
  const splitPages = new Map<string, number[]>()
  const wholeUses = new Map<string, number>()

  for (const { sources, target, pages } of plan) {
    const label = target ?? `delete ${sources[0]}`
    if (sources.length === 0) problems.push(`${label}: no sources`)
    if ((pages || target === null) && sources.length !== 1)
      problems.push(`${label}: splits and deletions take exactly one source`)
    for (const source of sources) {
      if (!(await exists(join(root, source)))) problems.push(`${source}: source not found`)
      if (pages) splitPages.set(source, [...(splitPages.get(source) ?? []), ...parsePages(pages)])
      else wholeUses.set(source, (wholeUses.get(source) ?? 0) + 1)
    }
    if (target === null) continue
    if (!target.toLowerCase().endsWith(".pdf")) problems.push(`${target}: not a .pdf name`)
    if (targets.has(target)) problems.push(`${target}: used twice in plan`)
    targets.add(target)
    if (await exists(join(root, target))) problems.push(`${target}: already exists`)
  }

  for (const [source, uses] of wholeUses)
    if (uses > 1 || splitPages.has(source)) problems.push(`${source}: used by more than one entry`)

  for (const [source, pages] of splitPages) {
    if (!(await exists(join(root, source)))) continue
    const pageCount = await tools.countPages(join(root, source))
    for (let page = 1; page <= pageCount; page++) {
      const count = pages.filter(p => p === page).length
      if (count === 0) problems.push(`${source}: page ${page} not assigned`)
      if (count > 1) problems.push(`${source}: page ${page} assigned twice`)
    }
    if (pages.some(page => page < 1 || page > pageCount))
      problems.push(`${source}: page out of range`)
  }

  if (problems.length) throw new Error(`Plan not applied:\n${problems.join("\n")}`)
}

/** Expand a page list like "1-3,5" into page numbers. */
function parsePages(
  /** Comma-separated one-based pages and inclusive ranges. */
  pages: string,
) {
  return pages.split(",").flatMap(part => {
    const [first, last = first] = part.split("-").map(Number)
    return Array.from({ length: last - first + 1 }, (_, i) => first + i)
  })
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
  /** Write the chosen pages with pdfseparate and pdfunite. */
  extractPages: async (
    /** Absolute source path. */
    source,
    /** One-based page numbers in output order. */
    pages,
    /** Absolute output path. */
    target,
  ) => {
    const dir = await mkdtemp(join(tmpdir(), "file-scans-"))
    const pagePaths = []
    for (const page of pages) {
      const pagePath = join(dir, `${page}.pdf`)
      await run("pdfseparate", ["-f", String(page), "-l", String(page), source, pagePath])
      pagePaths.push(pagePath)
    }
    if (pagePaths.length === 1) await copyFile(pagePaths[0], target)
    else await run("pdfunite", [...pagePaths, target])
    await rm(dir, { recursive: true })
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
  /** Destination path relative to the scans folder, or null to delete a duplicate source. */
  target: string | null
  /** Pages of a single source to file, like "1-2,4"; together a source's entries must cover every page once. */
  pages?: string
}

/** Operations on PDF files. */
type PdfTools = {
  /** Write the concatenation of the sources to the target. */
  mergePdfs: (sources: string[], target: string) => Promise<void>
  /** Write the given one-based pages of the source to the target. */
  extractPages: (source: string, pages: number[], target: string) => Promise<void>
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
  console.log(`Applied ${plan.length} entries`)
}
