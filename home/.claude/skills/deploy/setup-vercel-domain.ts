#!/usr/bin/env -S npx tsx
/// <reference types="node" />

/**
 * Sets up a Vercel project with a subdomain of herbcaudill.com and configures Porkbun DNS.
 *
 * Usage: setup-vercel-domain <project-name>
 * Example: setup-vercel-domain myproject
 *
 * This will:
 * - Link the repo herbcaudill/<project-name> to Vercel
 * - Add myproject.herbcaudill.com as the domain
 * - Configure DNS on Porkbun with project-specific CNAME
 *
 * Environment variables (loaded from ~/.secrets if not set):
 *   PORKBUN_API_KEY - Porkbun API key
 *   PORKBUN_SECRET_KEY - Porkbun secret key
 */

import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Load secrets from ~/.secrets if not already in environment
const loadSecrets = () => {
  if (process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_KEY) return

  const secretsPath = join(homedir(), ".secrets")
  if (!existsSync(secretsPath)) return

  const content = readFileSync(secretsPath, "utf-8")
  for (const line of content.split("\n")) {
    const match = line.match(/^export\s+(\w+)=["']?([^"'\n]+)["']?/)
    if (match) {
      const [, key, value] = match
      if (!process.env[key]) process.env[key] = value
    }
  }
}

loadSecrets()

const PORKBUN_API = "https://api.porkbun.com/api/json/v3"
const VERCEL_API = "https://api.vercel.com"
const BASE_DOMAIN = "herbcaudill.com"
const GITHUB_ORG = "herbcaudill"

// --- Helpers ---

const run = (cmd: string): string => {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { encoding: "utf-8", stdio: ["inherit", "pipe", "pipe"] }).trim()
}

const getVercelToken = (): string => {
  const authPath = join(homedir(), "Library/Application Support/com.vercel.cli/auth.json")
  if (!existsSync(authPath)) {
    throw new Error("Vercel CLI not authenticated. Run 'vercel login' first.")
  }
  const auth = JSON.parse(readFileSync(authPath, "utf-8"))
  return auth.token
}

const getProjectSpecificCname = async (domain: string): Promise<string> => {
  const token = getVercelToken()
  const res = await fetch(`${VERCEL_API}/v5/domains/${domain}/config`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to get domain config: ${res.statusText}`)
  }

  const config = (await res.json()) as { cnames?: string[] }
  if (!config.cnames || config.cnames.length === 0) {
    throw new Error("No project-specific CNAME found for domain")
  }

  // Remove trailing dot if present
  return config.cnames[0].replace(/\.$/, "")
}

const getPorkbunCredentials = () => {
  const apiKey = process.env.PORKBUN_API_KEY
  const secretKey = process.env.PORKBUN_SECRET_KEY
  if (!apiKey || !secretKey) {
    throw new Error("Missing PORKBUN_API_KEY or PORKBUN_SECRET_KEY")
  }
  return { apiKey, secretKey }
}

const porkbun = async (endpoint: string, data: Record<string, string> = {}) => {
  const { apiKey, secretKey } = getPorkbunCredentials()

  const res = await fetch(`${PORKBUN_API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: apiKey, secretapikey: secretKey, ...data }),
  })

  const json = await res.json()
  if (json.status !== "SUCCESS") {
    throw new Error(`Porkbun API error: ${json.message}`)
  }
  return json
}

type DnsRecord = { name: string; type: string; content: string }

const getDnsRecords = async (domain: string): Promise<DnsRecord[]> => {
  const { apiKey, secretKey } = getPorkbunCredentials()

  const res = await fetch(`${PORKBUN_API}/dns/retrieve/${domain}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: apiKey, secretapikey: secretKey }),
  })

  const json = (await res.json()) as { status: string; records?: DnsRecord[] }
  if (json.status !== "SUCCESS") return []
  return json.records ?? []
}

// --- Main ---

const main = async () => {
  let projectName = process.argv[2]

  // If no argument, infer from current directory
  if (!projectName) {
    const cwd = process.cwd()
    const match = cwd.match(/\/code\/herbcaudill\/([^/]+)/i)
    if (match) {
      projectName = match[1]
    } else {
      console.error("Usage: setup-vercel-domain [project-name]")
      console.error("Example: setup-vercel-domain myproject")
      console.error("")
      console.error("Or run from ~/code/herbcaudill/<project-name> with no arguments.")
      process.exit(1)
    }
  }

  const repo = `${GITHUB_ORG}/${projectName}`
  const subdomain = projectName
  const fullDomain = `${subdomain}.${BASE_DOMAIN}`

  console.log(`\n🚀 Setting up ${fullDomain} for ${repo}\n`)

  // 1. Link Vercel project to repo
  console.log("--- Linking Vercel project ---")
  run(`vercel link --yes --repo=https://github.com/${repo}`)

  // 2. Add domain to Vercel
  console.log("\n--- Adding domain to Vercel ---")
  try {
    run(`vercel domains add ${fullDomain}`)
  } catch {
    console.log("Domain may already be added, continuing...")
  }

  // 3. Get project-specific CNAME from Vercel
  console.log("\n--- Getting project-specific CNAME ---")
  const cname = await getProjectSpecificCname(fullDomain)
  console.log(`Project-specific CNAME: ${cname}`)

  // 4. Configure Porkbun DNS - add/update CNAME for subdomain
  console.log("\n--- Configuring Porkbun DNS ---")
  console.log(`Setting CNAME: ${subdomain} -> ${cname}`)

  // Check if record already exists with correct value
  const records = await getDnsRecords(BASE_DOMAIN)
  const existingRecord = records.find(
    r => r.name === fullDomain && r.type === "CNAME",
  )

  if (existingRecord?.content === cname) {
    console.log("CNAME record already correct, no changes needed")
  } else if (existingRecord) {
    // Update existing record
    await porkbun(`/dns/editByNameType/${BASE_DOMAIN}/CNAME/${subdomain}`, {
      content: cname,
    })
    console.log("CNAME record updated")
  } else {
    // Create new record
    await porkbun(`/dns/create/${BASE_DOMAIN}`, {
      type: "CNAME",
      name: subdomain,
      content: cname,
    })
    console.log("CNAME record created")
  }

  console.log(`\n✅ Done! ${fullDomain} is configured.`)
  console.log(`   DNS changes may take a few minutes to propagate.`)
  console.log(`   Check status: vercel domains inspect ${fullDomain}`)
}

main().catch((e) => {
  console.error(`\n❌ Error: ${e.message}`)
  process.exit(1)
})
