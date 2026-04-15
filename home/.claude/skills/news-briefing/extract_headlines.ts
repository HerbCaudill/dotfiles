#!/usr/bin/env node

/** Extract headline output lines from a news page's HTML. */
function extractHeadlineLines(
  /** The base URL used to resolve relative article URLs. */
  baseUrl: string,
  /** The raw HTML to parse. */
  html: string,
): string[] {
  const anchorRanges: Array<{ start: number; end: number; href: string }> = []
  const ariaMap = new Map<string, string>()
  const seen = new Set<string>()
  const lines: string[] = []

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1]
    const start = match.index ?? 0
    const openTagEnd = start + match[0].length
    const close = html.indexOf("</a>", openTagEnd)

    if (close > 0) {
      anchorRanges.push({ end: close + 4, href, start })
    }
  }

  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*aria-label=["']([^"']+)["'][^>]*>/gi,
  )) {
    ariaMap.set(match[2].trim(), match[1])
  }

  for (const match of html.matchAll(
    /<a\b[^>]*aria-label=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
  )) {
    ariaMap.set(match[1].trim(), match[2])
  }

  for (const match of html.matchAll(/<(h[23])\b[^>]*>(.*?)<\/\1>/gis)) {
    const content = match[2]
    const text = content
      .replace(/<[^>]+>/g, " ")
      .trim()
      .replace(/\s+/g, " ")

    if (text.length <= 15 || seen.has(text)) {
      continue
    }

    seen.add(text)

    const inlineHrefMatch = content.match(/href=["']([^"']+)["']/i)
    const headingPosition = match.index ?? 0
    const parentAnchor = anchorRanges.find(
      anchorRange => anchorRange.start < headingPosition && headingPosition < anchorRange.end,
    )
    const resolvedHref = inlineHrefMatch?.[1] ?? parentAnchor?.href ?? ariaMap.get(text) ?? ""
    const url =
      resolvedHref ?
        baseUrl ? new URL(resolvedHref, baseUrl).toString()
        : resolvedHref
      : ""

    lines.push(`${url} | ${text}`)
  }

  return lines
}

const { readFileSync } = require("node:fs")

const html = readFileSync(0, "utf8")
const lines = extractHeadlineLines(process.argv[2] ?? "", html)
process.stdout.write(lines.join("\n"))

if (lines.length > 0) {
  process.stdout.write("\n")
}
