#!/usr/bin/env npx tsx
/**
 * Bootstrap script for setting up a dev environment.
 * Works on both local machines and sprites.dev.
 *
 * Usage:
 *   npx tsx https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.ts
 *
 * For sprites (with GitHub auth):
 *   GITHUB_TOKEN=xxx SPRITE_NAME=mysprite npx tsx ...
 */

import { execSync } from "node:child_process"
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

const HOME = process.env.HOME!
const DOTFILES_REPO = "https://github.com/HerbCaudill/dotfiles.git"
const DOTFILES_DIR = join(HOME, "code/herbcaudill/dotfiles")

const SPRITE_NAME = process.env.SPRITE_NAME
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO_USER = process.env.REPO_USER
const REPO_NAME = process.env.REPO_NAME

/** Print success message with green checkmark. */
const success = (msg: string) => console.log(`\x1b[1;32m✓\x1b[0m ${msg}`)

/** Print warning message with yellow exclamation. */
const warn = (msg: string) => console.log(`\x1b[1;33m!\x1b[0m ${msg}`)

/** Execute a shell command silently. */
const run = (cmd: string, options: { cwd?: string } = {}) => {
  execSync(cmd, { stdio: "pipe", ...options })
}

/** Check if a command exists. */
const commandExists = (cmd: string) => {
  try {
    execSync(`command -v ${cmd}`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/** Get the latest asdf release tag from GitHub. */
const getLatestAsdfVersion = () => {
  try {
    const json = execSync(
      "curl -fsSL https://api.github.com/repos/asdf-vm/asdf/releases/latest",
      { encoding: "utf-8" }
    )
    const data = JSON.parse(json)
    return data.tag_name || "v0.14.1"
  } catch {
    return "v0.14.1"
  }
}

/** Append a line to a file if it doesn't already exist. */
const appendIfMissing = (file: string, line: string) => {
  const content = existsSync(file) ? readFileSync(file, "utf-8") : ""
  if (!content.includes(line)) {
    appendFileSync(file, line + "\n")
  }
}

// ---- Header ----
console.log()
console.log("─".repeat(process.stdout.columns || 80))
console.log("👾 Setting up dev environment...")
console.log()

// ---- Clone dotfiles ----
if (!existsSync(DOTFILES_DIR)) {
  mkdirSync(dirname(DOTFILES_DIR), { recursive: true })
  run(`git clone -q "${DOTFILES_REPO}" "${DOTFILES_DIR}"`)
}
success("Dotfiles")

// ---- Run install script (symlinks) ----
run(`node "${DOTFILES_DIR}/install.mjs"`)
success("Symlinks")

// ---- Install oh-my-zsh ----
const ohmyzshPath = join(HOME, ".oh-my-zsh/oh-my-zsh.sh")
if (!existsSync(ohmyzshPath)) {
  run(`rm -rf "${HOME}/.oh-my-zsh"`)
  run(
    `RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`
  )
}
success("oh-my-zsh")

// ---- Install zsh plugins ----
const ZSH_CUSTOM = process.env.ZSH_CUSTOM || join(HOME, ".oh-my-zsh/custom")

const autosuggestions = join(ZSH_CUSTOM, "plugins/zsh-autosuggestions")
if (!existsSync(autosuggestions)) {
  run(`git clone -q https://github.com/zsh-users/zsh-autosuggestions "${autosuggestions}"`)
}
success("zsh-autosuggestions")

const syntaxHighlighting = join(ZSH_CUSTOM, "plugins/zsh-syntax-highlighting")
if (!existsSync(syntaxHighlighting)) {
  run(`git clone -q https://github.com/zsh-users/zsh-syntax-highlighting "${syntaxHighlighting}"`)
}
success("zsh-syntax-highlighting")

// ---- Restore custom theme ----
const themeSrc = join(DOTFILES_DIR, "home/.oh-my-zsh/custom/themes/herb.zsh-theme")
const themeDst = join(ZSH_CUSTOM, "themes/herb.zsh-theme")
if (existsSync(themeSrc)) {
  mkdirSync(dirname(themeDst), { recursive: true })
  run(`ln -sf "${themeSrc}" "${themeDst}"`)
}
success("zsh theme")

// ---- Install asdf ----
const asdfDir = join(HOME, ".asdf")
if (!existsSync(asdfDir)) {
  const asdfVersion = getLatestAsdfVersion()
  run(`git clone -q https://github.com/asdf-vm/asdf.git "${asdfDir}" --branch "${asdfVersion}"`)
}
success("asdf")

// ---- Install pnpm ----
if (!commandExists("pnpm")) {
  try {
    run(`curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash bash`)
  } catch {
    // Ignore errors
  }
}
success("pnpm")

// ---- Install beads ----
if (!commandExists("bd")) {
  try {
    run(`curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash`)
  } catch {
    // Ignore errors
  }
}
success("beads")

// ---- Install/update Claude Code ----
try {
  run(`claude install latest --force`)
} catch {
  // Ignore errors
}
success("claude")

// ---- Sprite-specific setup ----
if (SPRITE_NAME) {
  const secretsFile = join(HOME, ".secrets")
  const localenvFile = join(HOME, ".localenv")

  // GitHub CLI auth
  if (GITHUB_TOKEN) {
    appendFileSync(secretsFile, `export GH_TOKEN=${GITHUB_TOKEN}\n`)
    success("GitHub CLI")
  } else {
    warn("GitHub CLI (set GH_TOKEN manually)")
  }

  // Create code directory
  mkdirSync(join(HOME, "code"), { recursive: true })

  // Save sprite name for prompt
  appendFileSync(localenvFile, `export SPRITE_NAME=${SPRITE_NAME}\n`)

  // Use nano as default editor
  appendIfMissing(localenvFile, "export EDITOR=nano")
  appendIfMissing(localenvFile, "export VISUAL=nano")

  // Clone repo if REPO_USER and REPO_NAME are set
  if (REPO_USER && REPO_NAME) {
    const codeDir = join(HOME, "code")
    const repoDir = join(codeDir, REPO_NAME)

    run(`gh repo clone "${REPO_USER}/${REPO_NAME}"`, { cwd: codeDir })
    success(`Cloned ${REPO_USER}/${REPO_NAME}`)

    appendFileSync(localenvFile, `export SPRITE_REPO_DIR=${repoDir}\n`)

    // pnpm and bd aren't in PATH yet
    const PNPM_HOME = join(HOME, ".local/share/pnpm")
    const PATH = `${PNPM_HOME}:${HOME}/.local/bin:${process.env.PATH}`

    try {
      run("pnpm install", { cwd: repoDir })
      success("pnpm install")
    } catch {
      // Ignore errors
    }

    try {
      execSync("bd init", { cwd: repoDir, stdio: "pipe", env: { ...process.env, PATH } })
      success("beads init")
    } catch {
      // Ignore errors
    }
  }
}

// ---- Done ----
console.log()
if (SPRITE_NAME) {
  console.log(`👾 ${SPRITE_NAME} is ready!`)
} else {
  success("Ready!")
}
