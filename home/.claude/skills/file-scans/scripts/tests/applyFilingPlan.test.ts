import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

import { applyFilingPlan } from "../applyFilingPlan.ts"

describe("applyFilingPlan", () => {
  test("renames single files and merges multi-part scans into year folders", async () => {
    const root = await makeScansFolder({
      "20260401_III 11111.pdf": "irs",
      "Lynne Inbox/20251229_a.pdf": "part 1",
      "Lynne Inbox/20251229_b.pdf": "part 2",
    })

    await applyFilingPlan(
      root,
      [
        { sources: ["20260401_III 11111.pdf"], target: "2026/20260302 IRS – CP2000 notice.pdf" },
        {
          sources: ["Lynne Inbox/20251229_a.pdf", "Lynne Inbox/20251229_b.pdf"],
          target: "2025/20251229 NC board – Social work license (Lynne).pdf",
        },
      ],
      fakePdfTools,
    )

    expect(await readFile(join(root, "2026/20260302 IRS – CP2000 notice.pdf"), "utf8")).toBe("irs")
    expect(
      await readFile(
        join(root, "2025/20251229 NC board – Social work license (Lynne).pdf"),
        "utf8",
      ),
    ).toBe("part 1|part 2")
    expect(await readdir(join(root, "Lynne Inbox"))).toEqual([])
    expect(await readFile(join(root, ".filing-log.jsonl"), "utf8")).toContain("CP2000")
  })

  test("splits a scan holding several documents and deletes duplicates", async () => {
    const root = await makeScansFolder({
      "bundle.pdf": "tax p1|tax p2|fine p1|note",
      "copy.pdf": "dup",
    })

    await applyFilingPlan(
      root,
      [
        { sources: ["bundle.pdf"], pages: "1-2", target: "2024/20240617 Tax receipt.pdf" },
        { sources: ["bundle.pdf"], pages: "3", target: "2024/20241101 Fine.pdf" },
        { sources: ["bundle.pdf"], pages: "4", target: "2025/20250101 Note.pdf" },
        { sources: ["copy.pdf"], target: null },
      ],
      fakePdfTools,
    )

    expect(await readFile(join(root, "2024/20240617 Tax receipt.pdf"), "utf8")).toBe(
      "tax p1|tax p2",
    )
    expect(await readFile(join(root, "2024/20241101 Fine.pdf"), "utf8")).toBe("fine p1")
    expect(await readFile(join(root, "2025/20250101 Note.pdf"), "utf8")).toBe("note")
    expect((await readdir(root)).sort()).toEqual([".filing-log.jsonl", "2024", "2025"])
  })

  test("refuses to split a scan when some of its pages are not assigned", async () => {
    const root = await makeScansFolder({ "bundle.pdf": "a|b|c" })

    await expect(
      applyFilingPlan(
        root,
        [{ sources: ["bundle.pdf"], pages: "1-2", target: "2024/20240101 A.pdf" }],
        fakePdfTools,
      ),
    ).rejects.toThrow("page 3 not assigned")

    expect(await readdir(root)).toEqual(["bundle.pdf"])
  })

  test("changes nothing when any target already exists", async () => {
    const root = await makeScansFolder({
      "a.pdf": "a",
      "b.pdf": "b",
      "2024/20240101 Taken.pdf": "existing",
    })

    await expect(
      applyFilingPlan(
        root,
        [
          { sources: ["a.pdf"], target: "2024/20240102 Fine.pdf" },
          { sources: ["b.pdf"], target: "2024/20240101 Taken.pdf" },
        ],
        fakePdfTools,
      ),
    ).rejects.toThrow("already exists")

    expect((await readdir(root)).sort()).toEqual(["2024", "a.pdf", "b.pdf"])
  })
})

/** Create a temporary scans folder containing the given files. */
async function makeScansFolder(
  /** Relative file paths mapped to their contents. */
  files: Record<string, string>,
) {
  const root = await mkdtemp(join(tmpdir(), "scans-"))
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(join(root, path, ".."), { recursive: true })
    await writeFile(join(root, path), contents)
  }
  return root
}

/** PDF tools that treat each file's text as one page. */
const fakePdfTools = {
  /** Concatenate the source files' text with a separator. */
  mergePdfs: async (
    /** Absolute source paths in page order. */
    sources: string[],
    /** Absolute output path. */
    target: string,
  ) => {
    const parts = await Promise.all(sources.map(source => readFile(source, "utf8")))
    await writeFile(target, parts.join("|"))
  },
  /** Copy the chosen separator-delimited parts. */
  extractPages: async (
    /** Absolute source path. */
    source: string,
    /** One-based page numbers in output order. */
    pages: number[],
    /** Absolute output path. */
    target: string,
  ) => {
    const parts = (await readFile(source, "utf8")).split("|")
    await writeFile(target, pages.map(page => parts[page - 1]).join("|"))
  },
  /** Count separator-delimited parts as pages. */
  countPages: async (
    /** Absolute PDF path. */
    path: string,
  ) => (await readFile(path, "utf8")).split("|").length,
}
