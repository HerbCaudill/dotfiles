import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

/** Keep a path-based Codex skill setting in the user config. */
export function syncCodexSkillConfig(
  /** Path to the mutable Codex config file */
  configPath: string,
  /** Absolute path to the skill entrypoint */
  skillPath: string,
) {
  const skillConfig = `[[skills.config]]\npath = "${skillPath}"\nenabled = false\n`
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, skillConfig, { mode: 0o600 })
    return
  }

  const config = readFileSync(configPath, "utf8")
  const headers = [...config.matchAll(/^[ \t]*\[\[?[^\n]+\]?\][ \t]*$/gm)]
  const escapedSkillPath = skillPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pathPattern = new RegExp(
    `^[ \\t]*path[ \\t]*=[ \\t]*["']${escapedSkillPath}["'][ \\t]*$`,
    "m",
  )

  for (const [index, header] of headers.entries()) {
    if (header[0].trim() !== "[[skills.config]]") continue

    const start = header.index
    const end = headers[index + 1]?.index ?? config.length
    const block = config.slice(start, end)
    if (!pathPattern.test(block)) continue

    const enabledPattern = /^([ \t]*enabled[ \t]*=[ \t]*)(?:true|false)([ \t]*)$/m
    const existingTrailingWhitespace = block.match(/\s*$/)?.[0] ?? ""
    const content = existingTrailingWhitespace
      ? block.slice(0, -existingTrailingWhitespace.length)
      : block
    const trailingWhitespace = existingTrailingWhitespace || "\n"
    const updatedBlock = enabledPattern.test(block)
      ? block.replace(enabledPattern, "$1false$2")
      : `${content}\nenabled = false${trailingWhitespace}`
    if (updatedBlock !== block)
      writeFileSync(configPath, `${config.slice(0, start)}${updatedBlock}${config.slice(end)}`)
    return
  }

  const separator = config.endsWith("\n") ? "\n" : "\n\n"

  writeFileSync(configPath, `${config}${separator}${skillConfig}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [configPath, skillPath] = process.argv.slice(2)
  if (!configPath || !skillPath)
    throw new Error("Usage: syncCodexSkillConfig.ts <config-path> <skill-path>")
  syncCodexSkillConfig(configPath, skillPath)
}
