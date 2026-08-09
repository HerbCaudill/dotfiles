import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import type { BuildFileDiffOptions } from "./types.ts"

/** Write modified, renamed, and deleted patches to one file and return each patch's start line. */
export function buildFileDiff(options: BuildFileDiffOptions): Map<string, number> {
  const locations = new Map<string, number>()
  const patches: string[] = []
  let nextLine = 1

  for (const file of options.files) {
    const status = file.status[0]?.toUpperCase()
    if (status === "A") continue

    const paths = file.oldPath ? [file.oldPath, file.path] : [file.path]
    const patch = execFileSync(
      "git",
      ["diff", "--no-ext-diff", "--unified=80", options.base, options.head, "--", ...paths],
      {
        cwd: options.repositoryPath,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      },
    ).trimEnd()

    if (!patch) continue
    locations.set(file.path, nextLine)
    patches.push(patch)
    nextLine += patch.split("\n").length + 2
  }

  writeFileSync(options.outputPath, patches.length > 0 ? `${patches.join("\n\n")}\n` : "")
  return locations
}
