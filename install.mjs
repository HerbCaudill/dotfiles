#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs"
import { dirname, isAbsolute, join, relative } from "node:path"

const DOTFILES_DIR = dirname(new URL(import.meta.url).pathname)
const HOME_DIR = join(DOTFILES_DIR, "home")
const CONFIG_FILE = join(DOTFILES_DIR, "symlink-dirs.conf")
const HOME = process.env.HOME

console.log(`Installing dotfiles from ${DOTFILES_DIR}`)

const EXTRA_SYMLINKS = [
  { src: ".claude/CLAUDE.md", target: ".codex/AGENTS.md" },
  { src: ".claude/skills", target: ".codex/skills" },
]

/** Remove any existing file, directory, or symlink at the target path. */
const removeExisting = (
  /** The absolute path to remove before linking. */
  target,
) => {
  try {
    const stat = lstatSync(target)
    console.log(`Removing existing: ${target}`)

    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      rmSync(target, { recursive: true, force: true })
      return
    }

    unlinkSync(target)
  } catch {
    // Target doesn't exist, that's fine
  }
}

// Read directory symlink paths from config
const dirPaths = existsSync(CONFIG_FILE)
  ? readFileSync(CONFIG_FILE, "utf-8")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
  : []

// Create directory symlinks
for (const dirPath of dirPaths) {
  const src = join(HOME_DIR, dirPath)
  const target = join(HOME, dirPath)

  if (!existsSync(src)) continue

  mkdirSync(dirname(target), { recursive: true })

  removeExisting(target)

  console.log(`Linking directory: ${dirPath}`)
  symlinkSync(src, target)
}

// Get all files recursively
/** Recursively enumerate all files under a directory. */
const getAllFiles = (
  /** The directory to walk. */
  dir,
) => {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap(entry => {
    const fullPath = join(dir, entry.name)
    return entry.isDirectory() ? getAllFiles(fullPath) : [fullPath]
  })
}

// Symlink individual files
for (const file of getAllFiles(HOME_DIR)) {
  const relPath = relative(HOME_DIR, file)

  // Skip files under directory-linked paths
  if (dirPaths.some(dirPath => relPath.startsWith(dirPath + "/"))) {
    continue
  }

  const target = join(HOME, relPath)

  mkdirSync(dirname(target), { recursive: true })

  removeExisting(target)

  console.log(`Linking: ${relPath}`)
  symlinkSync(file, target)
}

for (const { src, target } of EXTRA_SYMLINKS) {
  const absSrc = isAbsolute(src) ? src : join(HOME_DIR, src)
  const absTarget = isAbsolute(target) ? target : join(HOME, target)

  if (!existsSync(absSrc)) continue

  mkdirSync(dirname(absTarget), { recursive: true })
  removeExisting(absTarget)

  console.log(`Linking: ${target} -> ${src}`)
  symlinkSync(absSrc, absTarget)
}

console.log("Done!")
