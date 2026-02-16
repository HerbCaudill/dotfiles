#!/usr/bin/env npx tsx

/**
 * Setup script for OpenClaw on sprites.dev.
 * Automates the ~15 interactive wizard prompts into a single command with env vars.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... TELEGRAM_BOT_TOKEN=8551... npx tsx setup-openclaw.ts
 *
 * Or curl from raw GitHub:
 *   curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/scripts/setup-openclaw.ts | \
 *     ANTHROPIC_API_KEY=... TELEGRAM_BOT_TOKEN=... npx -y tsx -
 */

import { execSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

const HOME = process.env.HOME!

/** Read secrets from ~/.secrets, parsing `export KEY="value"` lines. */
const readSecrets = (): Record<string, string> => {
  const secretsPath = join(HOME, ".secrets")
  if (!existsSync(secretsPath)) return {}

  const content = readFileSync(secretsPath, "utf-8")
  const secrets: Record<string, string> = {}

  for (const line of content.split("\n")) {
    const match = line.match(/^export\s+(\w+)="(.+?)"/)
    if (match) secrets[match[1]] = match[2]
  }

  // Resolve variable references (e.g. GH_TOKEN=$GITHUB_TOKEN)
  for (const [key, value] of Object.entries(secrets)) {
    if (value.startsWith("$")) {
      const ref = value.slice(1)
      if (secrets[ref]) secrets[key] = secrets[ref]
    }
  }

  return secrets
}

// Env variables

const secrets = readSecrets()

/** Get a variable from env or ~/.secrets. */
const getVar = (name: string): string | undefined => process.env[name] ?? secrets[name]

/** Require a variable from env or ~/.secrets, exiting if missing. */
const requireVar = (name: string): string => {
  const value = getVar(name)
  if (!value) {
    console.error(`Error: ${name} not found in environment or ~/.secrets`)
    process.exit(1)
  }
  return value
}

const ANTHROPIC_API_KEY = requireVar("ANTHROPIC_API_KEY")
const TELEGRAM_BOT_TOKEN = requireVar("TELEGRAM_BOT_TOKEN")
const OPENAI_API_KEY = getVar("OPENAI_API_KEY")
const GOOGLE_PLACES_API_KEY = getVar("GOOGLE_PLACES_API_KEY")
const GEMINI_API_KEY = getVar("GEMINI_API_KEY")
const BRAVE_SEARCH_API_KEY = getVar("BRAVE_SEARCH_API_KEY")

// Paths

const OPENCLAW_DIR = join(HOME, ".openclaw")
const CONFIG_FILE = join(OPENCLAW_DIR, "openclaw.json")
const ZSHRC = join(HOME, ".zshrc")
const NVM_VERSIONS = "/.sprite/languages/node/nvm/versions/node"
const NODE_BIN_PATH = existsSync(NVM_VERSIONS)
  ? join(NVM_VERSIONS, readdirSync(NVM_VERSIONS)[0], "bin")
  : ""

let PATH = `${NODE_BIN_PATH}:${HOME}/.local/bin:${process.env.PATH}`

const stepStatus = new Map<string, Status>()
let headerLines = 0
const errors: { step: string; message: string }[] = []

// CONFIG

/** Gateway token, output to stdout at the end for the caller to capture. */
const gatewayToken = randomBytes(32).toString("hex")

/** Build the OpenClaw config object from environment variables. */
const buildConfig = () => {

  const env: Record<string, string> = {
    ...secrets,
    ANTHROPIC_API_KEY,
    TELEGRAM_BOT_TOKEN,
    ...(OPENAI_API_KEY ? { OPENAI_API_KEY } : {}),
    ...(GOOGLE_PLACES_API_KEY ? { GOOGLE_API_KEY: GOOGLE_PLACES_API_KEY } : {}),
    ...(GEMINI_API_KEY ? { GEMINI_API_KEY } : {}),
    ...(BRAVE_SEARCH_API_KEY ? { BRAVE_API_KEY: BRAVE_SEARCH_API_KEY } : {}),
  }

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
      token: randomBytes(32).toString("hex"),
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
      // Installer may exit non-zero due to /dev/tty in non-interactive sprite exec
      try {
        run(`curl -fsSL https://openclaw.ai/install.sh | bash`)
      } catch {}
      if (!commandExists("openclaw")) {
        throw new Error("openclaw not found after install")
      }
    }
  },

  "write config": () => {
    mkdirSync(OPENCLAW_DIR, { recursive: true })
    const config = buildConfig()
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n")
  },

  "initialize workspace": () => {
    run(`openclaw onboard --non-interactive --accept-risk --skip-health --skip-daemon`, {
      env: { ...process.env, PATH },
    })
  },

  "install skill dependencies": () => {
    run(`openclaw skills check`, { env: { ...process.env, PATH } })
  },

  "register sprite service": () => {
    const openclawPath = run(`which openclaw`, { env: { ...process.env, PATH } }).trim()
    run(
      `sprite-env services create openclaw-gateway --cmd "${openclawPath}" --args "gateway" --http-port 18789`,
    )
  },

  "start gateway": () => {
    const status = getGatewayStatus()
    if (status === "running") return
    try {
      run(`sprite-env services stop openclaw-gateway`, { env: { ...process.env, PATH } })
    } catch {}
    run(`sprite-env services start openclaw-gateway`, { env: { ...process.env, PATH } })
    // Give it a moment to bind the port
    execSync("sleep 2")
    const newStatus = getGatewayStatus()
    if (newStatus !== "running") {
      throw new Error(`Gateway status: ${newStatus}`)
    }
  },

  "fix path": () => {
    appendIfMissing(ZSHRC, `export PATH="$PATH:${NODE_BIN_PATH}"`)
  },
}

// MAIN

const main = () => {
  console.error()
  console.error("─".repeat(process.stderr.columns || 80))
  console.error("🦞 Setting up OpenClaw...")
  console.error()

  for (const name of Object.keys(steps)) {
    stepStatus.set(name, "pending")
  }
  render()

  for (const [name, fn] of Object.entries(steps)) {
    runStep(name, fn)
  }

  if (errors.length > 0) {
    console.error()
    console.error("\x1b[1;33mErrors:\x1b[0m")
    for (const { step, message } of errors) {
      console.error(`  ${step}: ${message}`)
    }
    process.exit(1)
  }

  console.error()
  console.error("\x1b[1;32m✓\x1b[0m OpenClaw is ready!")
  console.error()

  // Output token to stdout for machine consumption
  process.stdout.write(gatewayToken)
  process.exit(0)
}

// CHECKLIST UI

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

/** Get the gateway service status from sprite-env. */
const getGatewayStatus = (): string => {
  try {
    const output = run(`sprite-env services list`, { env: { ...process.env, PATH } })
    const services = JSON.parse(output) as { name: string; state: { status: string } }[]
    const gw = services.find(s => s.name === "openclaw-gateway")
    return gw?.state?.status ?? "missing"
  } catch {
    return "unknown"
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
