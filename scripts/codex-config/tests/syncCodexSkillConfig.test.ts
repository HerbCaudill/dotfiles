import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { syncCodexSkillConfig } from "../syncCodexSkillConfig.ts"

const skillName = "skill-creator"

describe("syncCodexSkillConfig", () => {
  test("creates a new user config when Codex has not created one yet", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-config-"))
    const configPath = join(directory, ".codex", "config.toml")

    syncCodexSkillConfig(configPath, skillName)

    expect(readFileSync(configPath, "utf8")).toBe(
      `[[skills.config]]\nname = "${skillName}"\nenabled = false\n`,
    )
    expect(statSync(configPath).mode & 0o777).toBe(0o600)
  })

  test("adds the disabled skill without changing existing config", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-config-"))
    const configPath = join(directory, "config.toml")
    const existingConfig = 'model = "gpt-5.6"\n\n[features]\nsteer = true\n'
    writeFileSync(configPath, existingConfig, { mode: 0o600 })

    syncCodexSkillConfig(configPath, skillName)

    expect(readFileSync(configPath, "utf8")).toBe(
      `${existingConfig}\n[[skills.config]]\nname = "${skillName}"\nenabled = false\n`,
    )
    expect(statSync(configPath).mode & 0o777).toBe(0o600)
  })

  test("normalizes an existing entry without creating duplicates", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-config-"))
    const configPath = join(directory, "config.toml")
    const existingConfig = `[[skills.config]]\nname = "${skillName}"\nenabled = true\n\n[desktop]\nappearanceTheme = "dark"\n`
    const expectedConfig = existingConfig.replace("enabled = true", "enabled = false")
    writeFileSync(configPath, existingConfig)

    syncCodexSkillConfig(configPath, skillName)
    syncCodexSkillConfig(configPath, skillName)

    expect(readFileSync(configPath, "utf8")).toBe(expectedConfig)
  })

  test("repairs an existing entry that has no enabled setting", () => {
    const directory = mkdtempSync(join(tmpdir(), "codex-config-"))
    const configPath = join(directory, "config.toml")
    writeFileSync(
      configPath,
      `[[skills.config]]\nname = "${skillName}"\n\n[desktop]\nappearanceTheme = "dark"\n`,
    )

    syncCodexSkillConfig(configPath, skillName)

    expect(readFileSync(configPath, "utf8")).toBe(
      `[[skills.config]]\nname = "${skillName}"\nenabled = false\n\n[desktop]\nappearanceTheme = "dark"\n`,
    )
  })
})
