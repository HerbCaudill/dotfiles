import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createHighlighter } from "shiki"
import { buildFileDiff } from "./buildFileDiff.ts"
import { escapeHtml } from "./escapeHtml.ts"
import { extractBracedDeclaration } from "./extractBracedDeclaration.ts"
import { toVscodeFileUrl } from "./toVscodeFileUrl.ts"
import type { ExplanationInput, RenderExplanationResult } from "./types.ts"

/** Render one structured explanation as self-contained HTML plus a companion file diff. */
export async function renderExplanation(
  input: ExplanationInput,
  outputPath: string,
): Promise<RenderExplanationResult> {
  if (input.schemaVersion !== 1) throw new Error("Unsupported explanation schema version")
  if (!path.basename(outputPath).startsWith(`${input.date}-`)) {
    throw new Error(`Output filename must start with ${input.date}-`)
  }

  const relativeOutput = path.relative(input.repository.path, outputPath)
  if (
    relativeOutput !== "" &&
    !relativeOutput.startsWith("..") &&
    !path.isAbsolute(relativeOutput)
  ) {
    throw new Error("Write the explanation outside the source repository")
  }

  const templatePath = path.resolve(import.meta.dirname, "../assets/explanation-template.html")
  const template = readFileSync(templatePath, "utf8")
  const files = input.files ?? []
  const codeBlocks = input.codeBlocks ?? []
  const base = execFileSync("git", ["rev-parse", "--verify", `${input.repository.base}^{commit}`], {
    cwd: input.repository.path,
    encoding: "utf8",
  }).trim()
  const head = execFileSync("git", ["rev-parse", "--verify", `${input.repository.head}^{commit}`], {
    cwd: input.repository.path,
    encoding: "utf8",
  }).trim()
  const diffPath = path.join(
    path.dirname(outputPath),
    `${input.date}-explanation-${input.slug}-files.diff`,
  )
  const diffLocations = buildFileDiff({
    repositoryPath: input.repository.path,
    base,
    head,
    files,
    outputPath: diffPath,
  })

  const languageAliases = new Map([
    ["ts", "typescript"],
    ["js", "javascript"],
    ["sh", "bash"],
    ["cs", "csharp"],
  ])
  const languages = [
    ...new Set(codeBlocks.map(block => languageAliases.get(block.language) ?? block.language)),
  ]
  const highlighter = await createHighlighter({
    themes: ["github-light"],
    langs: languages.length > 0 ? (languages as never) : ["text"],
  })
  const renderedCode = new Map(
    codeBlocks.map(block => {
      const language = languageAliases.get(block.language) ?? block.language
      const revision =
        block.source?.revision === "base"
          ? base
          : block.source?.revision === "head"
            ? head
            : block.source?.revision
              ? execFileSync(
                  "git",
                  ["rev-parse", "--verify", `${block.source.revision}^{commit}`],
                  {
                    cwd: input.repository.path,
                    encoding: "utf8",
                  },
                ).trim()
              : undefined
      const extracted = block.source
        ? extractBracedDeclaration(
            execFileSync("git", ["show", `${revision}:${block.source.path}`], {
              cwd: input.repository.path,
              encoding: "utf8",
              maxBuffer: 64 * 1024 * 1024,
            }),
            block.source.needle,
            block.source.path,
          )
        : undefined
      const code = block.code ?? extracted?.text
      if (!code) throw new Error(`Code block ${block.id} needs code or a pinned source declaration`)
      const sourcePath = block.path ?? block.source?.path
      const sourceLine = block.line ?? extracted?.line ?? 1
      const highlighted = highlighter.codeToHtml(code, {
        lang: language as never,
        theme: "github-light",
      })
      const href =
        block.href ??
        (sourcePath ? toVscodeFileUrl(input.repository.path, sourcePath, sourceLine) : undefined)
      const sourceLabel = block.deleted
        ? '<span class="deleted-label">deleted in this range</span>'
        : href && sourcePath
          ? `<a href="${escapeHtml(href)}">${escapeHtml(sourcePath)}:${sourceLine}</a>`
          : ""

      return [
        block.id,
        `<figure class="code-block"><figcaption><strong>${escapeHtml(block.title)}</strong>${sourceLabel}</figcaption>${highlighted}</figure>`,
      ]
    }),
  )
  highlighter.dispose()

  const fontFiles = [
    { family: "IBM Plex Sans", weight: 400, file: "ibm-plex-sans-latin-400-normal.woff2" },
    { family: "IBM Plex Sans", weight: 500, file: "ibm-plex-sans-latin-500-normal.woff2" },
    { family: "IBM Plex Sans", weight: 600, file: "ibm-plex-sans-latin-600-normal.woff2" },
    { family: "IBM Plex Mono", weight: 400, file: "ibm-plex-mono-latin-400-normal.woff2" },
  ]
  const fontFaceCss = fontFiles
    .map(font => {
      const packageName = font.family === "IBM Plex Mono" ? "ibm-plex-mono" : "ibm-plex-sans"
      const fontPath = path.join(
        import.meta.dirname,
        "node_modules",
        "@fontsource",
        packageName,
        "files",
        font.file,
      )
      if (!existsSync(fontPath)) return ""
      const data = readFileSync(fontPath).toString("base64")
      return `@font-face{font-family:"${font.family}";font-style:normal;font-weight:${font.weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")}`
    })
    .filter(Boolean)
    .join("\n")

  const categoryCounts = new Map<string, number>()
  for (const file of files) {
    for (const tag of file.tags) categoryCounts.set(tag, (categoryCounts.get(tag) ?? 0) + 1)
  }
  const categoryButtons = [...categoryCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([category, count]) =>
        `<button data-category="${escapeHtml(category)}">${escapeHtml(category)} <span>${count}</span></button>`,
    )
    .join("")
  const fileCards = files
    .map(file => {
      const status = file.status[0]?.toUpperCase() ?? "M"
      const statusName =
        status === "A"
          ? "added"
          : status === "D"
            ? "deleted"
            : status === "R"
              ? "renamed"
              : "modified"
      const diffLine = diffLocations.get(file.path)
      const href =
        file.href ??
        (diffLine === undefined
          ? toVscodeFileUrl(input.repository.path, file.path, 1)
          : toVscodeFileUrl(path.dirname(diffPath), path.basename(diffPath), diffLine))
      const previousPath = file.oldPath
        ? `<div class="rename-from">from ${escapeHtml(file.oldPath)}</div>`
        : ""
      const tags = file.tags.map(tag => `<span class="file-tag">${escapeHtml(tag)}</span>`).join("")
      const categories = `|${file.tags.join("|")}|`
      const search = `${file.path} ${file.oldPath ?? ""} ${file.description} ${file.tags.join(" ")}`
        .toLowerCase()
        .trim()

      return `<article class="file-row file-card" data-categories="${escapeHtml(categories)}" data-search="${escapeHtml(search)}">
  <div class="file-card-heading"><span class="file-status ${statusName}">${status}</span><a class="file-name" href="${escapeHtml(href)}" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</a></div>
  ${previousPath}
  <p class="file-description">${escapeHtml(file.description)}</p>
  <div class="file-tags">${tags}</div>
</article>`
    })
    .join("\n")

  const sections = input.sections
    .map(section => {
      const body = section.html.replace(/\{\{CODE:([^}]+)}}/g, (_placeholder, id: string) => {
        const code = renderedCode.get(id)
        if (!code) throw new Error(`Unknown code block placeholder: ${id}`)
        return code
      })
      const fileIndex =
        section.kind === "files"
          ? `<div class="file-tools"><input id="file-search" class="file-search" type="search" placeholder="Filter ${files.length} files…"><div class="filters"><button class="active" data-category="">All <span>${files.length}</span></button>${categoryButtons}</div></div>
<div id="file-list" class="file-list">${fileCards}</div><p id="file-count" class="muted">Showing ${files.length} of ${files.length} files.</p>`
          : ""
      return `<section id="${escapeHtml(section.id)}"><h2>${escapeHtml(section.title)}</h2>${body}${fileIndex}</section>`
    })
    .join("\n")
  const meta = input.meta?.length
    ? `<div class="range">${input.meta.map(item => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>`
    : ""
  const summary = input.summary?.length
    ? `<div class="summary">${input.summary.map(item => `<div><b>${escapeHtml(item.value)}</b><span>${escapeHtml(item.label)}</span></div>`).join("")}</div>`
    : ""
  const toc = input.sections
    .map(section => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>`)
    .join("")

  const html = template
    .replaceAll("{{FONT_FACE_CSS}}", fontFaceCss)
    .replaceAll("{{TITLE}}", escapeHtml(input.title))
    .replaceAll("{{LEDE}}", escapeHtml(input.lede))
    .replaceAll("{{META}}", meta)
    .replaceAll("{{SUMMARY}}", summary)
    .replaceAll("{{TOC}}", toc)
    .replaceAll("{{SECTIONS}}", sections)
    .replaceAll("{{FOOTER}}", escapeHtml(input.footer ?? ""))

  if (/\{\{[A-Z]+(?::[^}]+)?}}/.test(html)) {
    throw new Error("The rendered explanation contains an unresolved template placeholder")
  }
  if (!html.includes("white-space: pre-wrap")) {
    throw new Error("The explanation template must preserve code-block whitespace")
  }

  writeFileSync(outputPath, html)
  return { outputPath, diffPath }
}
