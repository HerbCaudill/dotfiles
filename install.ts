#!/usr/bin/env npx tsx
/// <reference types="node" />

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync } from "node:fs"
import { dirname, join, relative } from "node:path"

const DOTFILES_DIR = dirname(new URL(import.meta.url).pathname)
const HOME_DIR = join(DOTFILES_DIR, "home")
const CONFIG_FILE = join(DOTFILES_DIR, "symlink-dirs.conf")
const HOME = process.env.HOME!

console.log(`Installing dotfiles from ${DOTFILES_DIR}`)

// Read directory symlink paths from config
const dirPaths: string[] = existsSync(CONFIG_FILE)
  ? readFileSync(CONFIG_FILE, "utf-8")
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.startsWith("#"))
  : []

// Create directory symlinks
for (const dirPath of dirPaths) {
  const src = join(HOME_DIR, dirPath)
  const target = join(HOME, dirPath)

  if (!existsSync(src)) continue

  mkdirSync(dirname(target), { recursive: true })

  if (existsSync(target) || lstatSync(target).isSymbolicLink()) {
    console.log(`Removing existing: ${target}`)
    rmSync(target, { recursive: true, force: true })
  }

  console.log(`Linking directory: ${dirPath}`)
  symlinkSync(src, target)
}

// Get all files recursively
const getAllFiles = (dir: string): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry: { name: string; isDirectory: () => boolean }) => {
    const fullPath = join(dir, entry.name)
    return entry.isDirectory() ? getAllFiles(fullPath) : [fullPath]
  })
}

// Symlink individual files
for (const file of getAllFiles(HOME_DIR)) {
  const relPath = relative(HOME_DIR, file)

  // Skip files under directory-linked paths
  if (dirPaths.some((dirPath: string) => relPath.startsWith(dirPath + "/"))) {
    continue
  }

  const target = join(HOME, relPath)

  mkdirSync(dirname(target), { recursive: true })

  try {
    if (lstatSync(target).isSymbolicLink() || existsSync(target)) {
      console.log(`Removing existing: ${target}`)
      unlinkSync(target)
    }
  } catch {
    // File doesn't exist, that's fine
  }

  console.log(`Linking: ${relPath}`)
  symlinkSync(file, target)
}

console.log("Done!")
