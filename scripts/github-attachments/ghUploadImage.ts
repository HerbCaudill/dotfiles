#!/usr/bin/env -S node --experimental-strip-types

// Upload images to GitHub through a repo's web editor in Herb's signed-in browser, and print the
// tag GitHub returns for each one. Nothing is posted: the editor is cleared and its tab closed.

import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"

const usage = `Usage: gh-upload-image <owner/repo> <file...>

Uploads each file through the repo's new-discussion editor in your signed-in browser (via browse)
and prints the tag GitHub writes for it, one per line, in argument order. Nothing is posted.

An upload stays private to you until a post in that repo uses it, so put the tags in a discussion,
issue or comment on the same repo. The repo must have Discussions enabled.`

const [repo, ...files] = process.argv.slice(2)
if (!repo || files.length === 0 || !/^[\w.-]+\/[\w.-]+$/.test(repo)) fail(usage)

// browse reads local files only from its file roots, which include /tmp.
const staging = mkdtempSync("/tmp/gh-upload-image-")
try {
  // One folder per file keeps the original names, which GitHub uses as alt text.
  const staged = files.map((file, i) => {
    const target = join(staging, String(i), basename(file))
    mkdirSync(dirname(target))
    copyFileSync(resolve(file), target)
    return target
  })
  const script = join(staging, "upload.js")
  writeFileSync(
    script,
    uploadScript(
      `https://github.com/${repo}/discussions/new?category=${discussionCategory(repo)}`,
      staged,
    ),
  )

  const run = spawnSync(
    "browse",
    ["execute", "--rm", "--json", "--timeout-ms", "180000", "--file", script],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  )
  const result = parseResult(run.stdout)
  if (!result?.ok || !Array.isArray(result.value))
    fail(`Upload failed: ${result?.error?.message ?? run.stderr.trim()}`)
  for (const tag of result.value) console.log(tag)
} finally {
  rmSync(staging, { recursive: true, force: true })
}

/**
 * A discussion category anyone can post in, which the new-discussion editor needs. Announcement
 * categories redirect non-maintainers to the category chooser, so prefer the usual open ones.
 */
function discussionCategory(repo: string): string {
  const [owner, name] = repo.split("/")
  const slugs = execFileSync(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      `query={ repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { discussionCategories(first: 25) { nodes { slug } } } }`,
      "--jq",
      ".data.repository.discussionCategories.nodes[].slug",
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
  const slug =
    ["general", "ideas", "q-a"].find(s => slugs.includes(s)) ??
    slugs.find(s => s !== "announcements")
  if (!slug)
    fail(`${repo} has no open discussion categories; enable Discussions or use another repo.`)
  return slug
}

function parseResult(
  stdout: string,
): { ok: boolean; value?: unknown; error?: { message?: string } } | undefined {
  try {
    return JSON.parse(stdout)
  } catch {
    return undefined
  }
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Playwright code for `browse execute`: upload each file in turn and return the tags in order. */
function uploadScript(url: string, paths: string[]) {
  return `
const paths = ${JSON.stringify(paths)}
await page.goto(${JSON.stringify(url)})
const body = page.locator("#js-discussion-body")
const input = page.locator("#fc-js-discussion-body")
try {
  await body.waitFor({ timeout: 15000 })
} catch {
  throw new Error("No discussion editor at " + page.url() + " (signed out of GitHub?)")
}
const tags = []
for (const path of paths) {
  await body.fill("")
  await input.setInputFiles([path])
  await page.waitForFunction(
    () => {
      const value = document.querySelector("#js-discussion-body").value
      return /user-attachments\\/assets\\//.test(value) && !/Uploading/.test(value)
    },
    null,
    { timeout: 60000 },
  )
  tags.push((await body.inputValue()).trim())
}
await body.fill("")
return tags
`
}
