#!/usr/bin/env -S npx tsx

/**
 * Sets up a Vercel project with a subdomain of herbcaudill.com and configures Porkbun DNS.
 *
 * Usage: setup-vercel-domain <project-name>
 * Example: setup-vercel-domain myproject
 *
 * This will:
 * - Link the repo herbcaudill/<project-name> to Vercel
 * - Add myproject.herbcaudill.com as the domain
 * - Configure DNS on Porkbun
 *
 * Environment variables:
 *   PORKBUN_API_KEY - Porkbun API key
 *   PORKBUN_SECRET_KEY - Porkbun secret key
 */

import { execSync } from "node:child_process"

const PORKBUN_API = "https://api.porkbun.com/api/json/v3"
const BASE_DOMAIN = "herbcaudill.com"
const GITHUB_ORG = "herbcaudill"

// --- Helpers ---

const run = (cmd: string): string => {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { encoding: "utf-8", stdio: ["inherit", "pipe", "pipe"] }).trim()
}

const porkbun = async (endpoint: string, data: Record<string, string> = {}) => {
  const apiKey = process.env.PORKBUN_API_KEY
  const secretKey = process.env.PORKBUN_SECRET_KEY
  if (!apiKey || !secretKey) {
    throw new Error("Missing PORKBUN_API_KEY or PORKBUN_SECRET_KEY")
  }

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

// --- Main ---

const main = async () => {
  let projectName = process.argv[2]

  // If no argument, infer from current directory
  if (!projectName) {
    const cwd = process.cwd()
    const match = cwd.match(/\/code\/herbcaudill\/([^/]+)/)
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

  // 3. Configure Porkbun DNS - add CNAME for subdomain
  console.log("\n--- Configuring Porkbun DNS ---")
  console.log(`Adding CNAME: ${subdomain} -> cname.vercel-dns.com`)
  try {
    await porkbun(`/dns/create/${BASE_DOMAIN}`, {
      type: "CNAME",
      name: subdomain,
      content: "cname.vercel-dns.com",
    })
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      console.log("CNAME already exists, continuing...")
    } else {
      throw e
    }
  }

  console.log(`\n✅ Done! ${fullDomain} is configured.`)
  console.log(`   DNS changes may take a few minutes to propagate.`)
  console.log(`   Check status: vercel domains inspect ${fullDomain}`)
}

main().catch((e) => {
  console.error(`\n❌ Error: ${e.message}`)
  process.exit(1)
})
