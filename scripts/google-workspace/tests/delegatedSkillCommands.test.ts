import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const repositoryRoot = resolve(import.meta.dirname, "../../..")
const skillsDirectory = resolve(repositoryRoot, "home/.claude/skills")

/** Return the shared skill files that may issue Google Workspace API calls. */
function googleWorkspaceSkillFiles(): string[] {
  const gwsSkills = readdirSync(skillsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith("gws-"))
    .map(entry => resolve(skillsDirectory, entry.name, "SKILL.md"))

  return [...gwsSkills, resolve(skillsDirectory, "respond-to-rfp/SKILL.md")]
}

describe("delegated Google Workspace skill commands", () => {
  it("does not document raw gws for Workspace API operations", () => {
    const rawApiCommands = googleWorkspaceSkillFiles().flatMap(file =>
      readFileSync(file, "utf8")
        .split("\n")
        .filter(
          line =>
            /\bgws (calendar|docs|drive|gmail|sheets|tasks)\b/.test(line) &&
            !line.includes("--help"),
        )
        .map(line => `${file}: ${line}`),
    )

    expect(rawApiCommands).toEqual([])
  })
})
