#!/usr/bin/env npx tsx
/**
 * Bootstrap script for setting up a dev environment.
 * Works on both local machines and sprites.dev.
 *
 * Usage:
 *   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.ts | npm_config_update_notifier=false npx -y tsx -
 *
 * For sprites (with GitHub auth):
 *   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup.ts | \
 *     GITHUB_TOKEN=xxx SPRITE_NAME=mysprite npm_config_update_notifier=false npx -y tsx -
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

// ---- Checklist UI ----

type Status = "pending" | "running" | "done" | "warn" | "skip"

interface Step {
  name: string
  status: Status
}

const steps: Step[] = []
let headerLines = 0

/** Render the full checklist. */
const render = () => {
  // Move cursor up to overwrite previous render
  if (headerLines > 0) {
    process.stdout.write(`\x1b[${steps.length}A`)
  }

  for (const step of steps) {
    const icon =
      step.status === "done" ? "\x1b[1;32m✓\x1b[0m"
      : step.status === "warn" ? "\x1b[1;33m!\x1b[0m"
      : step.status === "skip" ? "\x1b[90m-\x1b[0m"
      : step.status === "running" ? "\x1b[1;34m…\x1b[0m"
      : "\x1b[90m○\x1b[0m"
    const text = step.status === "skip" ? `\x1b[90m${step.name}\x1b[0m` : step.name
    process.stdout.write(`\x1b[2K${icon} ${text}\n`)
  }
  headerLines = steps.length
}

/** Add a step to the checklist. */
const addStep = (name: string): number => {
  steps.push({ name, status: "pending" })
  return steps.length - 1
}

/** Update a step's status and re-render. */
const updateStep = (index: number, status: Status) => {
  steps[index].status = status
  render()
}

/** Run a step with automatic status updates. */
const runStep = (index: number, fn: () => void) => {
  updateStep(index, "running")
  try {
    fn()
    updateStep(index, "done")
  } catch {
    updateStep(index, "warn")
  }
}

// ---- Utilities ----

/** Execute a shell command silently. */
const run = (cmd: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) => {
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

/** Append a line to a file if it doesn't already exist. */
const appendIfMissing = (file: string, line: string) => {
  const content = existsSync(file) ? readFileSync(file, "utf-8") : ""
  if (!content.includes(line)) {
    appendFileSync(file, line + "\n")
  }
}

// ---- Define steps ----

const dotfilesStep = addStep("dotfiles")
const symlinksStep = addStep("symlinks")
const ohmyzshStep = addStep("oh-my-zsh")
const autosuggestionsStep = addStep("zsh-autosuggestions")
const syntaxHighlightingStep = addStep("zsh-syntax-highlighting")
const themeStep = addStep("zsh theme")
const asdfStep = addStep("asdf")
const pnpmStep = addStep("pnpm")
const beadsStep = addStep("beads")
const claudeStep = addStep("claude")

// Sprite-specific steps (added conditionally)
let githubCliStep: number | undefined
let cloneRepoStep: number | undefined
let pnpmInstallStep: number | undefined
let beadsInitStep: number | undefined

if (SPRITE_NAME) {
  githubCliStep = addStep("gh")
  if (REPO_USER && REPO_NAME) {
    cloneRepoStep = addStep(`clone ${REPO_USER}/${REPO_NAME}`)
    pnpmInstallStep = addStep("pnpm install")
    beadsInitStep = addStep("beads init")
  }
}

// ---- Header ----
console.log()
console.log("─".repeat(process.stdout.columns || 80))
console.log("👾 Setting up dev environment...")
console.log()

// Initial render
render()

// ---- Clone dotfiles ----
runStep(dotfilesStep, () => {
  if (!existsSync(DOTFILES_DIR)) {
    mkdirSync(dirname(DOTFILES_DIR), { recursive: true })
    run(`git clone -q "${DOTFILES_REPO}" "${DOTFILES_DIR}"`)
  }
})

// ---- Run install script (symlinks) ----
runStep(symlinksStep, () => {
  run(`node "${DOTFILES_DIR}/install.mjs"`)
})

// ---- Install oh-my-zsh ----
runStep(ohmyzshStep, () => {
  const ohmyzshPath = join(HOME, ".oh-my-zsh/oh-my-zsh.sh")
  if (!existsSync(ohmyzshPath)) {
    run(`rm -rf "${HOME}/.oh-my-zsh"`)
    run(
      `RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`,
    )
  }
})

// ---- Install zsh plugins ----
const ZSH_CUSTOM = process.env.ZSH_CUSTOM || join(HOME, ".oh-my-zsh/custom")

runStep(autosuggestionsStep, () => {
  const autosuggestions = join(ZSH_CUSTOM, "plugins/zsh-autosuggestions")
  if (!existsSync(autosuggestions)) {
    run(`git clone -q https://github.com/zsh-users/zsh-autosuggestions "${autosuggestions}"`)
  }
})

runStep(syntaxHighlightingStep, () => {
  const syntaxHighlighting = join(ZSH_CUSTOM, "plugins/zsh-syntax-highlighting")
  if (!existsSync(syntaxHighlighting)) {
    run(`git clone -q https://github.com/zsh-users/zsh-syntax-highlighting "${syntaxHighlighting}"`)
  }
})

// ---- Restore custom theme ----
runStep(themeStep, () => {
  const themeSrc = join(DOTFILES_DIR, "home/.oh-my-zsh/custom/themes/herb.zsh-theme")
  const themeDst = join(ZSH_CUSTOM, "themes/herb.zsh-theme")
  if (existsSync(themeSrc)) {
    mkdirSync(dirname(themeDst), { recursive: true })
    run(`ln -sf "${themeSrc}" "${themeDst}"`)
  }
})

// ---- Install asdf ----
runStep(asdfStep, () => {
  const asdfDir = join(HOME, ".asdf")
  if (!existsSync(asdfDir)) {
    run(`git clone -q https://github.com/asdf-vm/asdf.git "${asdfDir}"`)
  }
})

// ---- Install pnpm ----
runStep(pnpmStep, () => {
  if (!commandExists("pnpm")) {
    run(`curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash bash`)
  }
})

// ---- Install beads ----
runStep(beadsStep, () => {
  if (!commandExists("bd")) {
    run(
      `curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash`,
    )
  }
})

// ---- Install/update Claude Code ----
runStep(claudeStep, () => {
  run(`claude install latest --force`)
})

// ---- Sprite-specific setup ----
if (SPRITE_NAME) {
  const secretsFile = join(HOME, ".secrets")
  const localenvFile = join(HOME, ".localenv")

  // GitHub CLI auth
  if (githubCliStep !== undefined) {
    if (GITHUB_TOKEN) {
      runStep(githubCliStep, () => {
        appendFileSync(secretsFile, `export GH_TOKEN=${GITHUB_TOKEN}\n`)
      })
    } else {
      updateStep(githubCliStep, "warn")
    }
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

    if (cloneRepoStep !== undefined) {
      runStep(cloneRepoStep, () => {
        run(`gh repo clone "${REPO_USER}/${REPO_NAME}"`, { cwd: codeDir })
      })
    }

    appendFileSync(localenvFile, `export SPRITE_REPO_DIR=${repoDir}\n`)

    // pnpm and bd aren't in PATH yet
    const PNPM_HOME = join(HOME, ".local/share/pnpm")
    const PATH = `${PNPM_HOME}:${HOME}/.local/bin:${process.env.PATH}`

    if (pnpmInstallStep !== undefined) {
      runStep(pnpmInstallStep, () => {
        run("pnpm install", { cwd: repoDir })
      })
    }

    if (beadsInitStep !== undefined) {
      runStep(beadsInitStep, () => {
        run("bd init", { cwd: repoDir, env: { ...process.env, PATH } })
      })
    }
  }
}

// ---- Done ----
console.log()
if (SPRITE_NAME) {
  console.log(`👾 ${SPRITE_NAME} is ready!`)
} else {
  console.log("\x1b[1;32m✓\x1b[0m Ready!")
}
