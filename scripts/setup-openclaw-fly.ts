#!/usr/bin/env npx tsx

/**
 * Setup script for OpenClaw on Fly.io Machines.
 * Runs locally, orchestrating the remote VM via the `fly` CLI.
 *
 * Prerequisites:
 *   - flyctl installed (~/.fly/bin/fly)
 *   - Logged in to Fly.io (fly auth login)
 *   - API keys in ~/.secrets or environment
 *
 * Usage:
 *   npx tsx scripts/setup-openclaw-fly.ts
 *
 * Environment variables (reads from ~/.secrets if present):
 *   ANTHROPIC_API_KEY   (required)
 *   OPENAI_API_KEY      (optional)
 *   BRAVE_SEARCH_API_KEY (optional)
 */

import { execSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const HOME = process.env.HOME!
const APP_NAME = "herbcaudill-marvin"
const REGION = "cdg"
const VOLUME_NAME = "openclaw_data"
const VOLUME_SIZE_GB = 1
const IMAGE = "ghcr.io/openclaw/openclaw:latest"

/** Load ~/.secrets into process.env if it exists. */
const loadSecrets = () => {
  const secretsFile = join(HOME, ".secrets")
  if (!existsSync(secretsFile)) return
  const content = readFileSync(secretsFile, "utf-8")
  for (const line of content.split("\n")) {
    const match = line.match(/^export\s+(\w+)=["']?(.+?)["']?\s*$/)
    if (match) {
      const [, key, value] = match
      if (!process.env[key]) process.env[key] = value
    }
  }
}

/** Require a variable from env, exiting if missing. */
const requireVar = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    console.error(`Error: ${name} not found in environment or ~/.secrets`)
    process.exit(1)
  }
  return value
}

/** Optional env var. */
const optionalVar = (name: string): string | undefined => process.env[name]

/** Build the openclaw.json config. */
const buildConfig = () => {
  const gatewayToken = randomBytes(32).toString("hex")

  const config: Record<string, unknown> = {
    auth: {
      profiles: {
        "anthropic:default": { provider: "anthropic", mode: "api_key" },
      },
    },
    agents: {
      defaults: {
        model: {
          primary: "anthropic/claude-opus-4-6",
          fallbacks: ["anthropic/claude-sonnet-4-5"],
        },
        compaction: { mode: "safeguard" },
        heartbeat: { every: "30m" },
        maxConcurrent: 4,
      },
      list: [{ id: "main", default: true }],
    },
    tools: {
      profile: "coding",
      web: {
        search: {
          enabled: !!optionalVar("BRAVE_SEARCH_API_KEY"),
          maxResults: 5,
        },
      },
    },
    commands: {
      native: "auto",
      nativeSkills: "auto",
      restart: true,
      ownerDisplay: "raw",
    },
    gateway: {
      port: 3000,
      mode: "local",
      bind: "lan",
      auth: { mode: "token", token: gatewayToken },
      controlUi: {
        allowedOrigins: [`https://${APP_NAME}.fly.dev`],
        dangerouslyAllowHostHeaderOriginFallback: true,
      },
    },
  }

  return { config, gatewayToken }
}

// Steps

const steps: Record<string, () => void> = {
  "check flyctl": () => {
    if (!commandExists("fly")) {
      throw new Error("flyctl not found. Install: curl -L https://fly.io/install.sh | sh")
    }
    const whoami = run("fly auth whoami").trim()
    if (!whoami || whoami.includes("not logged in")) {
      throw new Error("Not logged in to Fly.io. Run: fly auth login")
    }
  },

  "create app": () => {
    try {
      run(`fly apps list --json`)
      const apps = JSON.parse(run(`fly apps list --json`)) as { Name: string }[]
      if (apps.some(a => a.Name === APP_NAME)) return
    } catch {}
    run(`fly apps create ${APP_NAME}`)
  },

  "create volume": () => {
    try {
      const volumes = JSON.parse(run(`fly volumes list --app ${APP_NAME} --json`)) as {
        Name: string
      }[]
      if (volumes.some(v => v.Name === VOLUME_NAME)) return
    } catch {}
    run(`fly volumes create ${VOLUME_NAME} --size ${VOLUME_SIZE_GB} --region ${REGION} --app ${APP_NAME} -y`)
  },

  "set secrets": () => {
    const secrets: Record<string, string> = {
      ANTHROPIC_API_KEY: requireVar("ANTHROPIC_API_KEY"),
    }

    const optional: Record<string, string> = {
      OPENAI_API_KEY: "OPENAI_API_KEY",
      BRAVE_SEARCH_API_KEY: "BRAVE_SEARCH_API_KEY",
      GEMINI_API_KEY: "GEMINI_API_KEY",
      GOOGLE_PLACES_API_KEY: "GOOGLE_PLACES_API_KEY",
    }

    for (const [flyKey, envKey] of Object.entries(optional)) {
      const val = optionalVar(envKey)
      if (val) secrets[flyKey] = val
    }

    const args = Object.entries(secrets)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ")
    run(`fly secrets set ${args} --app ${APP_NAME}`)
  },

  "deploy": () => {
    run(`fly deploy --app ${APP_NAME} --image ${IMAGE} --region ${REGION} --ha=false`, {
      timeout: 300_000,
    })
  },

  "wait for machine": () => {
    for (let i = 0; i < 30; i++) {
      try {
        const status = run(`fly status --app ${APP_NAME}`).trim()
        if (status.includes("running")) return
      } catch {}
      execSync("sleep 2")
    }
    throw new Error("Machine did not reach running state within 60s")
  },

  "write config": () => {
    const { config, gatewayToken } = buildConfig()
    const json = JSON.stringify(config, null, 2)
    // Write config via SSH — escape for shell
    flySSH(`mkdir -p /data && cat > /data/openclaw.json << 'OCEOF'\n${json}\nOCEOF`)

    console.error()
    console.error(`  Gateway token: ${gatewayToken}`)
    console.error(`  Dashboard: https://${APP_NAME}.fly.dev/`)
  },

  "update openclaw": () => {
    try {
      flySSH("openclaw update --yes")
    } catch {
      // update may not be available or may fail non-fatally
    }
  },

  "restart machine": () => {
    try {
      const machines = JSON.parse(run(`fly machines list --app ${APP_NAME} --json`)) as {
        id: string
      }[]
      if (machines.length > 0) {
        run(`fly machine restart ${machines[0].id} --app ${APP_NAME}`)
      }
    } catch {}
  },
}

// Main

const main = () => {
  loadSecrets()

  console.error()
  console.error("─".repeat(process.stderr.columns || 80))
  console.error("Setting up OpenClaw on Fly.io...")
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
  console.error(`  https://${APP_NAME}.fly.dev/`)
  console.error()

  process.exit(0)
}

// Checklist UI

const stepStatus = new Map<string, Status>()
let headerLines = 0
const errors: { step: string; message: string }[] = []

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

// Utilities

/** Execute a shell command silently, returning stdout. */
const run = (
  cmd: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
): string => {
  const { timeout = 120_000, ...rest } = options
  try {
    return execSync(cmd, {
      stdio: "pipe",
      shell: "/bin/bash",
      timeout,
      env: { ...process.env, PATH: `${HOME}/.fly/bin:${process.env.PATH}` },
      ...rest,
    }).toString()
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string }
    const stderr = err.stderr?.toString().trim()
    const stdout = err.stdout?.toString().trim()
    const output = [stderr, stdout].filter(Boolean).join("\n")
    throw new Error(output || err.message || "Command failed")
  }
}

/** Run a command on the Fly machine via SSH. */
const flySSH = (cmd: string): string => {
  return run(`fly ssh console --app ${APP_NAME} -C "${cmd.replace(/"/g, '\\"')}"`)
}

/** Check if a command exists on PATH. */
const commandExists = (cmd: string): boolean => {
  try {
    execSync(`command -v ${cmd}`, {
      stdio: "pipe",
      shell: "/bin/bash",
      env: { ...process.env, PATH: `${HOME}/.fly/bin:${process.env.PATH}` },
    })
    return true
  } catch {
    return false
  }
}

// Types

type Status = "pending" | "running" | "done" | "warn" | "skip"

main()
