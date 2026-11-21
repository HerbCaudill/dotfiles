// Lists devresults-next routes by visual review status on origin/main, and the files with
// uncommitted changes in the main checkout, so the caller can pick routes to queue.
//
//   node --experimental-strip-types candidates.mts [--repo <path>] [--json]

import { execFileSync } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"

type Candidate = { route: string; status: "in-progress" | "none"; date?: string; notes?: string }

const args = process.argv.slice(2)
const repoIndex = args.indexOf("--repo")
const repo = repoIndex >= 0 ? args[repoIndex + 1] : join(homedir(), "Code/DevResults/devresults-next")
const json = args.includes("--json")
const reviewsDir = "tests/e2e/coverage/reviews"

const git = (...gitArgs: string[]) =>
  execFileSync("git", ["-C", repo, ...gitArgs], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })

git("fetch", "--quiet", "origin")

const reviewFiles = git("ls-tree", "-r", "--name-only", "origin/main", reviewsDir)
  .split("\n")
  .filter(file => file.endsWith(".json"))

const records = reviewFiles.map(file => JSON.parse(git("show", `origin/main:${file}`)))

const candidates: Candidate[] = records
  .filter(record => record.visual?.status !== "reviewed")
  .map(record => ({
    route: record.route,
    status: record.visual?.status === "in-progress" ? "in-progress" : "none",
    date: record.visual?.date,
    notes: record.visual?.notes,
  }))
  .sort((a, b) => (a.status === b.status ? a.route.localeCompare(b.route) : a.status === "in-progress" ? -1 : 1))

const reviewedCount = records.length - candidates.length

const dirtyFiles = git("status", "--porcelain")
  .split("\n")
  .filter(Boolean)
  .map(line => line.slice(3))

if (json) {
  process.stdout.write(JSON.stringify({ total: records.length, reviewedCount, candidates, dirtyFiles }, null, 2) + "\n")
} else {
  const inProgress = candidates.filter(c => c.status === "in-progress")
  const none = candidates.filter(c => c.status === "none")
  const lines = [
    `${records.length} routes: ${reviewedCount} reviewed, ${inProgress.length} in progress, ${none.length} not reviewed`,
    "",
    "In progress:",
    ...inProgress.map(c => `  ${c.route}  (${c.date ?? "?"}${c.notes ? `: ${c.notes}` : ""})`),
    "",
    "Not reviewed:",
    ...none.map(c => `  ${c.route}`),
    "",
    "Uncommitted in the main checkout:",
    ...dirtyFiles.map(file => `  ${file}`),
  ]
  process.stdout.write(lines.join("\n") + "\n")
}
