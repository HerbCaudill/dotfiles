#!/usr/bin/env node

/** Extract article paragraphs from a news page's HTML. */
function extractArticleParagraphs(
  /** The raw HTML to parse. */
  html: string,
): string[] {
  const articleMatch = html.match(/<article\b[^>]*>(.*?)<\/article>/is)
  const content = articleMatch?.[1] ?? html
  let total = 0
  const paragraphs: string[] = []

  for (const match of content.matchAll(/<p\b[^>]*>(.*?)<\/p>/gis)) {
    const text = match[1]
      .replace(/<[^>]+>/g, " ")
      .trim()
      .replace(/\s+/g, " ")

    if (text.length <= 40) {
      continue
    }

    paragraphs.push(text)
    total += text.length

    if (total > 3000) {
      break
    }
  }

  return paragraphs
}

const { readFileSync } = require("node:fs")

const html = readFileSync(0, "utf8")
const paragraphs = extractArticleParagraphs(html)
process.stdout.write(paragraphs.join("\n"))

if (paragraphs.length > 0) {
  process.stdout.write("\n")
}
