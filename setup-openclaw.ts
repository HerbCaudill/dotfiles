#!/usr/bin/env npx tsx

/**
 * Setup script for OpenClaw on sprites.dev.
 * Automates the ~15 interactive wizard prompts into a single command with env vars.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... TELEGRAM_BOT_TOKEN=8551... npx tsx setup-openclaw.ts
 *
 * Or curl from raw GitHub:
 *   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/setup-openclaw.ts | \
 *     ANTHROPIC_API_KEY=... TELEGRAM_BOT_TOKEN=... npx -y tsx -
 */

import { execSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Require an environment variable, exiting with an error if missing. */
const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    console.error(`Error: ${name} environment variable is required`)
    process.exit(1)
  }
  return value
}

// Env variables

const HOME = process.env.HOME!
const ANTHROPIC_API_KEY = requireEnv("ANTHROPIC_API_KEY")
const TELEGRAM_BOT_TOKEN = requireEnv("TELEGRAM_BOT_TOKEN")
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY

// Paths

const OPENCLAW_DIR = join(HOME, ".openclaw")
const CONFIG_FILE = join(OPENCLAW_DIR, "openclaw.json")
const ZSHRC = join(HOME, ".zshrc")
const NODE_BIN_PATH = "/.sprite/languages/node/nvm/versions/node/v22.20.0/bin"

let PATH = `${NODE_BIN_PATH}:${HOME}/.local/bin:${process.env.PATH}`

const stepStatus = new Map<string, Status>()
let headerLines = 0
const errors: { step: string; message: string }[] = []

// CONFIG

/** Build the OpenClaw config object from environment variables. */
const buildConfig = () => {
  const gatewayToken = randomBytes(32).toString("hex")

  const env: Record<string, string> = {
    ANTHROPIC_API_KEY,
    TELEGRAM_BOT_TOKEN,
  }
  if (OPENAI_API_KEY) env.OPENAI_API_KEY = OPENAI_API_KEY
  if (GOOGLE_PLACES_API_KEY) env.GOOGLE_API_KEY = GOOGLE_PLACES_API_KEY
  if (GEMINI_API_KEY) env.GEMINI_API_KEY = GEMINI_API_KEY
  if (BRAVE_SEARCH_API_KEY) env.BRAVE_API_KEY = BRAVE_SEARCH_API_KEY

  return {
    env,
    auth: {
      profiles: {
        "anthropic:default": { provider: "anthropic", mode: "api_key" },
      },
    },
    agents: {
      defaults: {
        model: {
          primary: "anthropic/claude-opus-4-6",
          fallbacks: ["openai/gpt-5.2"],
        },
      },
    },
    channels: {
      telegram: {
        enabled: true,
        botToken: TELEGRAM_BOT_TOKEN,
        dmPolicy: "pairing",
        historyLimit: 50,
      },
    },
    tools: {
      profile: "coding",
      web: {
        search: {
          enabled: !!BRAVE_SEARCH_API_KEY,
          ...(BRAVE_SEARCH_API_KEY ? { apiKey: BRAVE_SEARCH_API_KEY } : {}),
          maxResults: 5,
        },
      },
    },
    hooks: {
      enabled: true,
    },
    skills: {
      install: {
        nodeManager: "pnpm",
      },
    },
    gateway: {
      mode: "local",
      port: 18789,
      bind: "loopback",
      auth: {
        mode: "token",
        token: gatewayToken,
      },
    },
  }
}

// STEPS

const steps: Record<string, () => void> = {
  "install openclaw cli": () => {
    if (!commandExists("openclaw")) {
      run(`curl -fsSL https://openclaw.ai/install.sh | bash`)
    }
  },

  "write config": () => {
    mkdirSync(OPENCLAW_DIR, { recursive: true })
    const config = buildConfig()
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n")
  },

  "initialize workspace": () => {
    run(`openclaw setup --non-interactive`, { env: { ...process.env, PATH } })
  },

  "install skill dependencies": () => {
    run(`openclaw skills check`, { env: { ...process.env, PATH } })
  },

  "register sprite service": () => {
    const clawdbotPath = run(`which clawdbot`, { env: { ...process.env, PATH } }).trim()
    run(
      `sprite-env services create openclaw-gateway --cmd "${clawdbotPath}" --args "gateway" --http-port 18789`,
    )
  },

  "fix path": () => {
    appendIfMissing(ZSHRC, `export PATH="$PATH:${NODE_BIN_PATH}"`)
  },
}

// MAIN

const main = () => {
  console.log()
  console.log("─".repeat(process.stdout.columns || 80))
  console.log("🐾 Setting up OpenClaw...")
  console.log()

  for (const name of Object.keys(steps)) {
    stepStatus.set(name, "pending")
  }
  render()

  for (const [name, fn] of Object.entries(steps)) {
    runStep(name, fn)
  }

  if (errors.length > 0) {
    console.log()
    console.log("\x1b[1;33mErrors:\x1b[0m")
    for (const { step, message } of errors) {
      console.log(`  ${step}: ${message}`)
    }
    process.exit(1)
  }

  console.log()
  console.log("\x1b[1;32m✓\x1b[0m OpenClaw is ready!")
  console.log()
  console.log("  Verify with: openclaw status")
  console.log("  Gateway:     openclaw gateway status")
  process.exit(0)
}

// CHECKLIST UI

/** Render the full checklist. */
const render = () => {
  if (headerLines > 0) {
    process.stdout.write(`\x1b[${stepStatus.size}A`)
  }
  for (const [name, status] of stepStatus) {
    const icon =
      status === "done" ? "✓"
      : status === "warn" ? "!"
      : status === "skip" ? "−"
      : status === "running" ? "⋯"
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

/** Execute a shell command silently, returning stdout. */
const run = (cmd: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): string => {
  try {
    return execSync(cmd, { stdio: "pipe", shell: "/bin/bash", ...options }).toString()
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string }
    const stderr = err.stderr?.toString().trim()
    const stdout = err.stdout?.toString().trim()
    const output = [stderr, stdout].filter(Boolean).join("\n")
    throw new Error(output || err.message || "Command failed")
  }
}

/** Check if a command exists on PATH. */
const commandExists = (cmd: string) => {
  try {
    execSync(`command -v ${cmd}`, {
      stdio: "pipe",
      shell: "/bin/bash",
      env: { ...process.env, PATH },
    })
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
