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

// Env variables

const HOME = process.env.HOME!
const SPRITE_NAME = process.env.SPRITE_NAME
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN
const REPO_USER = process.env.REPO_USER
const REPO_NAME = process.env.REPO_NAME

// Paths

const DOTFILES_REPO = "https://github.com/HerbCaudill/dotfiles.git"
const DOTFILES_DIR = join(HOME, "code/herbcaudill/dotfiles")
const secretsFile = join(HOME, ".secrets")
const localenvFile = join(HOME, ".localenv")
const PNPM_HOME = join(HOME, ".local/share/pnpm")
const codeDir = join(HOME, "code")
const PATH = `${PNPM_HOME}:${HOME}/.local/bin:${process.env.PATH}`

const ZSH_CUSTOM = process.env.ZSH_CUSTOM || join(HOME, ".oh-my-zsh/custom")
const isRepo = SPRITE_NAME && REPO_USER && REPO_NAME
const repoDir = REPO_NAME ? join(codeDir, REPO_NAME) : ""

const stepStatus = new Map<string, Status>()
let headerLines = 0
const errors: { step: string; message: string }[] = []

// STEPS

const steps: Record<string, () => void> = {
  "clone dotfiles": () => {
    if (!existsSync(DOTFILES_DIR)) {
      mkdirSync(dirname(DOTFILES_DIR), { recursive: true })
      run(`git clone -q "${DOTFILES_REPO}" "${DOTFILES_DIR}"`)
    }
  },

  symlinks: () => {
    run(`node "${DOTFILES_DIR}/install.mjs"`)
  },

  "oh-my-zsh": () => {
    const ohmyzshPath = join(HOME, ".oh-my-zsh/oh-my-zsh.sh")
    if (!existsSync(ohmyzshPath)) {
      run(`rm -rf "${HOME}/.oh-my-zsh"`)
      run(
        `RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"`,
      )
    }
  },

  "zsh-autosuggestions": () => {
    const autosuggestions = join(ZSH_CUSTOM, "plugins/zsh-autosuggestions")
    if (!existsSync(autosuggestions))
      run(`git clone -q https://github.com/zsh-users/zsh-autosuggestions "${autosuggestions}"`)
  },

  "zsh-syntax-highlighting": () => {
    const syntaxHighlighting = join(ZSH_CUSTOM, "plugins/zsh-syntax-highlighting")
    if (!existsSync(syntaxHighlighting))
      run(
        `git clone -q https://github.com/zsh-users/zsh-syntax-highlighting "${syntaxHighlighting}"`,
      )
  },

  "zsh theme": () => {
    const themeSrc = join(DOTFILES_DIR, "home/.oh-my-zsh/custom/themes/herb.zsh-theme")
    const themeDst = join(ZSH_CUSTOM, "themes/herb.zsh-theme")
    if (existsSync(themeSrc)) {
      mkdirSync(dirname(themeDst), { recursive: true })
      run(`ln -sf "${themeSrc}" "${themeDst}"`)
    }
  },

  asdf: () => {
    const asdfDir = join(HOME, ".asdf")
    if (!existsSync(asdfDir)) run(`git clone -q https://github.com/asdf-vm/asdf.git "${asdfDir}"`)
  },

  pnpm: () => {
    if (!commandExists("pnpm"))
      run(`curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash bash`)
  },

  beads: () => {
    if (!commandExists("bd"))
      run(
        `curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash`,
      )
  },

  claude: () => {
    if (CLAUDE_CODE_OAUTH_TOKEN)
      appendFileSync(secretsFile, `export CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}\n`)
    run(`claude install latest --force`)
  },

  gh: () => {
    if (GITHUB_TOKEN) appendFileSync(secretsFile, `export GH_TOKEN=${GITHUB_TOKEN}\n`)
  },

  ...(isRepo ?
    {
      [`clone ${REPO_NAME}`]: () => {
        run(`gh repo clone "${REPO_USER}/${REPO_NAME}"`, { cwd: codeDir })
      },

      "pnpm install": () => {
        run("pnpm install", { cwd: repoDir, env: { ...process.env, PATH } })
      },

      "beads init": () => {
        run("bd init", { cwd: repoDir, env: { ...process.env, PATH } })
      },
    }
  : {}),
}

// MAIN

const main = () => {
  console.log()
  console.log("─".repeat(process.stdout.columns || 80))
  console.log("👾 Setting up dev environment...")
  console.log()

  // Initialize step statuses and render
  for (const name of Object.keys(steps)) {
    stepStatus.set(name, "pending")
  }
  render()

  // Run all steps
  for (const [name, fn] of Object.entries(steps)) {
    runStep(name, fn)
  }

  // Sprite-specific post-setup
  if (SPRITE_NAME) {
    const codeDir = join(HOME, "code")

    mkdirSync(codeDir, { recursive: true })
    appendFileSync(localenvFile, `export SPRITE_NAME=${SPRITE_NAME}\n`)
    appendIfMissing(localenvFile, "export EDITOR=nano")
    appendIfMissing(localenvFile, "export VISUAL=nano")

    if (REPO_USER && REPO_NAME) {
      const repoDir = join(codeDir, REPO_NAME)
      appendFileSync(localenvFile, `export SPRITE_REPO_DIR=${repoDir}\n`)
    }
  }

  // ---- Show errors ----
  if (errors.length > 0) {
    console.log()
    console.log("\x1b[1;33mErrors:\x1b[0m")
    for (const { step, message } of errors) {
      console.log(`  ${step}: ${message}`)
    }
    process.exit(1)
  }

  // ---- Done ----
  console.log()
  if (SPRITE_NAME) {
    console.log(`👾 ${SPRITE_NAME} is ready!`)
  } else {
    console.log("\x1b[1;32m✓\x1b[0m Ready!")
  }

  process.exit(0)
}

// CHECKLIST UI

/** Render the full checklist. */
const render = () => {
  // Move cursor up to overwrite previous render
  if (headerLines > 0) {
    process.stdout.write(`\x1b[${stepStatus.size}A`)
  }

  for (const [name, status] of stepStatus) {
    const icon =
      status === "done" ? "✓"
      : status === "warn" ? "✗"
      : status === "skip" ? "−"
      : status === "running" ? "⟳"
      : "○"
    process.stdout.write(`\x1b[2K${icon} ${name}\n`)
  }
  headerLines = stepStatus.size
}

/** Update a step's status and re-render. */
const updateStep = (name: string, status: Status) => {
  stepStatus.set(name, status)
  render()
}

/** Run a step with automatic status updates. */
const runStep = (name: string, fn: () => void) => {
  updateStep(name, "running")
  try {
    fn()
    updateStep(name, "done")
  } catch (e) {
    updateStep(name, "warn")
    const message = e instanceof Error ? e.message : String(e)
    errors.push({ step: name, message })
  }
}

// UTILITIES

/** Execute a shell command silently, capturing output for error reporting. */
const run = (cmd: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) => {
  try {
    execSync(cmd, { stdio: "pipe", ...options })
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string }
    const stderr = err.stderr?.toString().trim()
    const stdout = err.stdout?.toString().trim()
    const output = [stderr, stdout].filter(Boolean).join("\n")
    throw new Error(output || err.message || "Command failed")
  }
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

// TYPES

type Status = "pending" | "running" | "done" | "warn" | "skip"

main()
