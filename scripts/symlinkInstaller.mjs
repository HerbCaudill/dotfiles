import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative } from "node:path"

/** Extra cross-harness symlinks that point at the shared Claude config. */
export const EXTRA_SYMLINKS = [
  { src: ".claude/CLAUDE.md", target: ".codex/AGENTS.md" },
  { src: ".claude/skills", target: ".codex/skills" },
  { src: ".claude/CLAUDE.md", target: ".pi/agent/AGENTS.md" },
  { src: ".claude/skills", target: ".pi/agent/skills" },
]

/** Remove any existing file, directory, or symlink at the target path. */
export const removeExisting = (
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

/** Read the list of paths that should be symlinked as whole directories. */
export const loadDirectorySymlinkPaths = (
  /** The absolute path to the .symlinks config file. */
  configFile,
) =>
  existsSync(configFile) ?
    readFileSync(configFile, "utf-8")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
  : []

/** Recursively enumerate all files under a directory. */
export const getAllFiles = (
  /** The directory to walk. */
  dir,
) => {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap(entry => {
    const fullPath = join(dir, entry.name)
    return entry.isDirectory() ? getAllFiles(fullPath) : [fullPath]
  })
}

/**
 * Ensure no ancestor directory of target is a symlink back into the repo.
 * This can happen if a directory was previously symlinked as a whole; we
 * replace it with a real directory so individual file symlinks work correctly.
 */
export const ensureRealParentDirs = (
  /** The absolute path to the managed home directory in the repo. */
  managedHomeDir,
  /** The absolute path to the real home directory. */
  home,
  /** Absolute path of the target file in $HOME. */
  target,
) => {
  const parts = relative(home, target).split("/")
  let current = home

  for (const part of parts.slice(0, -1)) {
    current = join(current, part)

    try {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink()) {
        const resolved = realpathSync(current)
        if (resolved.startsWith(managedHomeDir)) {
          console.log(`Replacing directory symlink with real directory: ${relative(home, current)}`)
          unlinkSync(current)
          mkdirSync(current, { recursive: true })
        }
      }
    } catch {
      // Doesn't exist yet, that's fine
    }
  }
}

/** Create the configured extra symlinks that map Claude config into other harnesses. */
export const installExtraSymlinks = (
  /** The absolute path to the managed home directory in the repo. */
  managedHomeDir,
  /** The absolute path to the real home directory. */
  home,
  /** The symlinks to create. */
  extraSymlinks = EXTRA_SYMLINKS,
) => {
  for (const { src, target } of extraSymlinks) {
    const absSrc = isAbsolute(src) ? src : join(managedHomeDir, src)
    const absTarget = isAbsolute(target) ? target : join(home, target)

    if (!existsSync(absSrc)) continue

    mkdirSync(dirname(absTarget), { recursive: true })
    removeExisting(absTarget)

    console.log(`Linking: ${target} -> ${src}`)
    symlinkSync(absSrc, absTarget)
  }
}

/** Install dotfile symlinks from the repo's home/ tree into the user's home directory. */
export const installDotfiles = ({
  /** Absolute path to the dotfiles repository root. */
  dotfilesDir,
  /** Absolute path to the real home directory. */
  home,
}) => {
  const managedHomeDir = join(dotfilesDir, "home")
  const configFile = join(dotfilesDir, ".symlinks")
  const directorySymlinkPaths = loadDirectorySymlinkPaths(configFile)

  console.log(`Installing dotfiles from ${dotfilesDir}`)

  for (const dirPath of directorySymlinkPaths) {
    const src = join(managedHomeDir, dirPath)
    const target = join(home, dirPath)

    if (!existsSync(src)) continue

    mkdirSync(dirname(target), { recursive: true })
    removeExisting(target)

    console.log(`Linking directory: ${dirPath}`)
    symlinkSync(src, target)
  }

  for (const file of getAllFiles(managedHomeDir)) {
    const relativePath = relative(managedHomeDir, file)

    if (directorySymlinkPaths.some(dirPath => relativePath.startsWith(dirPath + "/"))) {
      continue
    }

    const target = join(home, relativePath)

    ensureRealParentDirs(managedHomeDir, home, target)
    mkdirSync(dirname(target), { recursive: true })
    removeExisting(target)

    console.log(`Linking: ${relativePath}`)
    symlinkSync(file, target)
  }

  installExtraSymlinks(managedHomeDir, home)

  console.log("Done!")
}
