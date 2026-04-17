#!/usr/bin/env npx tsx

/**
 * Bootstrap script for sprites.dev environments.
 *
 * Usage:
 *   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/scripts/setup-sprite.ts | npm_config_update_notifier=false npx -y tsx -
 *
 * With GitHub auth:
 *   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/scripts/setup-sprite.ts | \
 *     GITHUB_TOKEN=xxx SPRITE_NAME=mysprite npm_config_update_notifier=false npx -y tsx -
 */

import { execSync, spawnSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"

const HOME = process.env.HOME!
const SPRITE_NAME = process.env.SPRITE_NAME
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN
const REPO_USER = process.env.REPO_USER
const REPO_NAME = process.env.REPO_NAME

const DOTFILES_REPO = "https://github.com/HerbCaudill/dotfiles.git"
const DOTFILES_DIR = join(HOME, "code/herbcaudill/dotfiles")
const secretsFile = join(HOME, ".secrets")
const localenvFile = join(HOME, ".localenv")
const PNPM_HOME = join(HOME, ".local/share/pnpm")
const BREW_PREFIX = process.platform === "darwin" ? "/opt/homebrew" : "/home/linuxbrew/.linuxbrew"
const codeDir = join(HOME, "code")
let PATH = `${PNPM_HOME}:${HOME}/.local/bin:${process.env.PATH}`

const ZSH_CUSTOM = process.env.ZSH_CUSTOM || join(HOME, ".oh-my-zsh/custom")
const isRepo = SPRITE_NAME && REPO_USER && REPO_NAME
const repoDir = REPO_NAME ? join(codeDir, REPO_NAME) : ""

const stepStatus = new Map<string, Status>()
let headerLines = 0
const errors: { step: string; message: string }[] = []

const steps: Record<string, () => void> = {
  "clone dotfiles": () => {
    if (REPO_NAME === "dotfiles") return
    if (!existsSync(DOTFILES_DIR)) {
      mkdirSync(dirname(DOTFILES_DIR), { recursive: true })
      run(`git clone -q "${DOTFILES_REPO}" "${DOTFILES_DIR}"`)
    }
  },

  homebrew: () => {
    if (!commandExists("brew")) {
      run(
        `NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`,
      )
      PATH = `${BREW_PREFIX}/bin:${BREW_PREFIX}/sbin:${PATH}`
    }
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

  "zsh autosuggestions": () => {
    const autosuggestions = join(ZSH_CUSTOM, "plugins/zsh-autosuggestions")
    if (!existsSync(autosuggestions)) {
      run(`git clone -q https://github.com/zsh-users/zsh-autosuggestions "${autosuggestions}"`)
    }
  },

  "zsh syntax highlighting": () => {
    const syntaxHighlighting = join(ZSH_CUSTOM, "plugins/zsh-syntax-highlighting")
    if (!existsSync(syntaxHighlighting)) {
      run(
        `git clone -q https://github.com/zsh-users/zsh-syntax-highlighting "${syntaxHighlighting}"`,
      )
    }
  },

  "zsh theme": () => {
    const themeSrc = join(DOTFILES_DIR, "home/.oh-my-zsh/custom/themes/herb.zsh-theme")
    const themeDst = join(ZSH_CUSTOM, "themes/herb.zsh-theme")
    if (existsSync(themeSrc)) {
      mkdirSync(dirname(themeDst), { recursive: true })
      run(`ln -sf "${themeSrc}" "${themeDst}"`)
    }
  },

  pnpm: () => {
    if (!commandExists("pnpm")) {
      run(`curl -fsSL https://get.pnpm.io/install.sh | SHELL=/bin/bash bash`)
    }
  },

  beads: () => {
    if (!commandExists("bd")) {
      run(
        `curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash`,
      )
    }
  },

  claude: () => {
    run(`claude install latest --force`, { env: { ...process.env, PATH } })
    if (CLAUDE_CODE_OAUTH_TOKEN) {
      appendIfMissing(secretsFile, `export CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}`)
    }
  },

  gh: () => {
    if (GITHUB_TOKEN) {
      appendFileSync(secretsFile, `export GH_TOKEN=${GITHUB_TOKEN}\n`)
      run(`gh auth setup-git`, { env: { ...process.env, PATH, GH_TOKEN: GITHUB_TOKEN } })
    }
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

const main = () => {
  console.error()
  console.error("─".repeat(process.stderr.columns || 80))
  console.error("👾 Setting up sprite environment...")
  console.error()

  for (const name of Object.keys(steps)) {
    stepStatus.set(name, "pending")
  }
  render()

  for (const [name, fn] of Object.entries(steps)) {
    runStep(name, fn)
  }

  if (SPRITE_NAME) {
    mkdirSync(codeDir, { recursive: true })
    appendFileSync(localenvFile, `export SPRITE_NAME=${SPRITE_NAME}\n`)
    appendIfMissing(localenvFile, "export EDITOR=nano")
    appendIfMissing(localenvFile, "export VISUAL=nano")

    if (REPO_USER && REPO_NAME) {
      appendFileSync(localenvFile, `export SPRITE_REPO_DIR=${join(codeDir, REPO_NAME)}\n`)
    }
  }

  loadEnvFile(secretsFile)
  loadEnvFile(localenvFile)

  if (errors.length > 0) {
    console.error()
    console.error("\x1b[1;33mErrors:\x1b[0m")
    for (const { step, message } of errors) {
      console.error(`  ${step}: ${message}`)
    }
    process.exit(1)
  }

  console.error()
  console.error(`👾 ${SPRITE_NAME ?? "Sprite"} is ready!`)
  console.error()

  if (process.stdin.isTTY) {
    const result = spawnSync("/bin/zsh", ["-l"], {
      stdio: "inherit",
      cwd: repoDir || codeDir,
    })
    process.exit(result.status ?? 0)
  }

  process.exit(0)
}

/** Render the full checklist. */
const render = () => {
  if (headerLines > 0) {
    process.stderr.write(`\x1b[${stepStatus.size}A`)
  }

  for (const [name, status] of stepStatus) {
    const icon =
      status === "done" ? "✓"
      : status === "warn" ? "!"
      : status === "skip" ? "−"
      : status === "running" ? "⋯"
      : "○"
    process.stderr.write(`\x1b[2K${icon} ${name}\n`)
  }
  headerLines = stepStatus.size
}

/** Update a step's status and re-render. */
const updateStep = (
  /** The step name */
  name: string,
  /** The new status */
  status: Status,
) => {
  stepStatus.set(name, status)
  render()
}

/** Run a step with automatic status updates. */
const runStep = (
  /** The step name */
  name: string,
  /** The step function */
  fn: () => void,
) => {
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

/** Execute a shell command silently, capturing output for error reporting. */
const run = (
  /** The shell command */
  cmd: string,
  /** Execution options */
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) => {
  try {
    execSync(cmd, { stdio: "pipe", shell: "/bin/bash", ...options })
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string }
    const stderr = err.stderr?.toString().trim()
    const stdout = err.stdout?.toString().trim()
    const output = [stderr, stdout].filter(Boolean).join("\n")
    throw new Error(output || err.message || "Command failed")
  }
}

/** Check if a command exists. */
const commandExists = (
  /** The command name */
  cmd: string,
) => {
  try {
    execSync(`command -v ${cmd}`, { stdio: "pipe", shell: "/bin/bash" })
    return true
  } catch {
    return false
  }
}

/** Append a line to a file if it doesn't already exist. */
const appendIfMissing = (
  /** The file path */
  file: string,
  /** The line to append */
  line: string,
) => {
  const content = existsSync(file) ? readFileSync(file, "utf-8") : ""
  if (!content.includes(line)) {
    appendFileSync(file, line + "\n")
  }
}

/** Load env vars from a shell file into process.env. */
const loadEnvFile = (
  /** The env file path */
  file: string,
) => {
  if (!existsSync(file)) return
  const content = readFileSync(file, "utf-8")
  for (const line of content.split("\n")) {
    const match = line.match(/^export\s+([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (match) {
      const [, key, value] = match
      process.env[key] = value.replace(/^["']|["']$/g, "")
    }
  }
}

type Status = "pending" | "running" | "done" | "warn" | "skip"

main()
