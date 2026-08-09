import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, test } from "vitest"

describe("renderExplanation", () => {
  test("renders the approved shell and links modified files to a companion diff", () => {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "explain-diff-test-"))
    const repositoryPath = path.join(temporaryDirectory, "repository")
    const inputPath = path.join(temporaryDirectory, "input.json")
    const outputPath = path.join(temporaryDirectory, "2026-08-09-explanation-test.html")
    const diffPath = path.join(temporaryDirectory, "2026-08-09-explanation-test-files.diff")

    execFileSync("git", ["init", repositoryPath])
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: repositoryPath,
    })
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repositoryPath })
    writeFileSync(
      path.join(repositoryPath, "changed.ts"),
      "export function answer() {\n  return 41\n}\n",
    )
    writeFileSync(path.join(repositoryPath, "deleted.ts"), "export const removed = true\n")
    writeFileSync(path.join(repositoryPath, "old-name.ts"), "export const renamed = true\n")
    execFileSync("git", ["add", "."], { cwd: repositoryPath })
    execFileSync("git", ["commit", "-m", "base"], { cwd: repositoryPath })
    const base = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryPath,
      encoding: "utf8",
    }).trim()

    writeFileSync(
      path.join(repositoryPath, "changed.ts"),
      "export function answer() {\n  return 42\n}\n",
    )
    writeFileSync(path.join(repositoryPath, "added.ts"), "export const added = true\n")
    rmSync(path.join(repositoryPath, "deleted.ts"))
    renameSync(path.join(repositoryPath, "old-name.ts"), path.join(repositoryPath, "new-name.ts"))
    execFileSync("git", ["add", "."], { cwd: repositoryPath })
    execFileSync("git", ["commit", "-m", "head"], { cwd: repositoryPath })
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryPath,
      encoding: "utf8",
    }).trim()

    writeFileSync(
      inputPath,
      JSON.stringify({
        schemaVersion: 1,
        title: "A test explanation",
        lede: "A concrete explanation of a small change.",
        date: "2026-08-09",
        slug: "test",
        repository: { path: repositoryPath, base, head },
        meta: ["base → head"],
        summary: [{ value: "2", label: "files changed" }],
        codeBlocks: [
          {
            id: "complete-function",
            title: "The whole function",
            language: "typescript",
            source: {
              revision: "head",
              path: "changed.ts",
              needle: "export function answer",
            },
          },
        ],
        files: [
          {
            status: "M",
            path: "changed.ts",
            description: "Updates the returned value.",
            tags: ["Runtime"],
          },
          {
            status: "A",
            path: "added.ts",
            description: "Adds a small module.",
            tags: ["Generated"],
          },
          {
            status: "D",
            path: "deleted.ts",
            description: "Removes an obsolete module.",
            tags: ["Cleanup"],
          },
          {
            status: "R100",
            oldPath: "old-name.ts",
            path: "new-name.ts",
            description: "Renames a module.",
            tags: ["Vocabulary"],
          },
        ],
        sections: [
          {
            id: "background",
            title: "Background",
            html: '<p>The old value was 41.</p><div class="note"><strong>One callout style.</strong> Blue is enough.</div>',
          },
          {
            id: "code",
            title: "Code",
            html: "{{CODE:complete-function}}",
          },
          {
            id: "files",
            title: "File index",
            kind: "files",
            html: "<p>Every description stays visible.</p>",
          },
        ],
        footer: "Generated for a test.",
      }),
    )

    const scriptPath = path.resolve(import.meta.dirname, "../runRenderExplanation.ts")
    const result = spawnSync(process.execPath, [scriptPath, inputPath, outputPath], {
      encoding: "utf8",
    })

    expect(result.status, result.stderr).toBe(0)
    const html = readFileSync(outputPath, "utf8")
    const diff = readFileSync(diffPath, "utf8")
    const text = html.replace(/<[^>]+>/g, "")

    expect(html).toContain('class="note"')
    expect(html).not.toContain("note-warning")
    expect(html).toContain(".check strong{color:var(--fg)}")
    expect(html).toContain("white-space: pre-wrap")
    expect(html).toContain("github-light")
    expect(html).toContain('class="file-list"')
    expect(html).toContain("Updates the returned value.")
    expect(html).toContain("Runtime")
    expect(html).not.toContain("<details")
    expect(html).not.toContain('class="file-table"')
    expect(html).toContain(`vscode://file/${diffPath}:1`)
    expect(html).toContain(`vscode://file/${repositoryPath}/added.ts:1`)
    expect(diff).toContain("diff --git a/changed.ts b/changed.ts")
    expect(diff).toContain("diff --git a/deleted.ts b/deleted.ts")
    expect(diff).toContain("diff --git a/old-name.ts b/new-name.ts")
    expect(html).toMatch(/href="vscode:\/\/file\/[^\"]+files\.diff:\d+" title="deleted\.ts"/)
    expect(html).toMatch(/href="vscode:\/\/file\/[^\"]+files\.diff:\d+" title="new-name\.ts"/)
    expect(html).toContain('font-family:"IBM Plex Sans"')
    expect(html).toContain("data:font/woff2;base64,")
    expect(text).toContain("export function answer")
    expect(text).toContain("return 42")
  })
})
