import { lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "vitest"

import { installDotfiles } from "../symlinkInstaller.mjs"

const tempDirs: string[] = []

describe("installDotfiles", () => {
  test("creates shared Claude symlinks for Codex and pi", () => {
    const dotfilesDir = mkdtempSync(join(tmpdir(), "dotfiles-repo-"))
    const homeDir = mkdtempSync(join(tmpdir(), "dotfiles-home-"))
    tempDirs.push(dotfilesDir, homeDir)

    mkdirSync(join(dotfilesDir, "home/.claude/skills"), { recursive: true })
    writeFileSync(join(dotfilesDir, ".symlinks"), ".claude/skills\n")
    writeFileSync(join(dotfilesDir, "home/.claude/CLAUDE.md"), "# Global agent memory\n")
    writeFileSync(join(dotfilesDir, "home/.claude/skills/test.md"), "# skill\n")

    installDotfiles({ dotfilesDir, home: homeDir })

    expect(lstatSync(join(homeDir, ".codex/AGENTS.md")).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(homeDir, ".codex/AGENTS.md"))).toBe(
      join(dotfilesDir, "home/.claude/CLAUDE.md"),
    )
    expect(lstatSync(join(homeDir, ".codex/skills")).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(homeDir, ".codex/skills"))).toBe(
      join(dotfilesDir, "home/.claude/skills"),
    )
    expect(lstatSync(join(homeDir, ".pi/agent/AGENTS.md")).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(homeDir, ".pi/agent/AGENTS.md"))).toBe(
      join(dotfilesDir, "home/.claude/CLAUDE.md"),
    )
    expect(lstatSync(join(homeDir, ".pi/agent/skills")).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(homeDir, ".pi/agent/skills"))).toBe(
      join(dotfilesDir, "home/.claude/skills"),
    )
  })
})

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true })
  }
})
