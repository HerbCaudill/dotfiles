#!/usr/bin/env -S npx tsx

/**
 * Sets up a Vercel project with a custom domain and configures Porkbun DNS.
 *
 * Usage: setup-vercel-domain <repo> <domain>
 * Example: setup-vercel-domain herbcaudill/myproject example.com
 *
 * Environment variables:
 *   PORKBUN_API_KEY - Porkbun API key
 *   PORKBUN_SECRET_KEY - Porkbun secret key
 */

import { execSync } from "node:child_process"

const PORKBUN_API = "https://api.porkbun.com/api/json/v3"

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
  const [repo, domain] = process.argv.slice(2)

  if (!repo || !domain) {
    console.error("Usage: setup-vercel-domain <repo> <domain>")
    console.error("Example: setup-vercel-domain herbcaudill/myproject example.com")
    process.exit(1)
  }

  console.log(`\n🚀 Setting up ${domain} for ${repo}\n`)

  // 1. Link Vercel project to repo
  console.log("--- Linking Vercel project ---")
  run(`vercel link --yes --repo=https://github.com/${repo}`)

  // 2. Add domain to Vercel
  console.log("\n--- Adding domain to Vercel ---")
  try {
    run(`vercel domains add ${domain}`)
  } catch {
    console.log("Domain may already be added, continuing...")
  }

  // 3. Get verification info from Vercel
  console.log("\n--- Getting domain verification info ---")
  const inspectOutput = run(`vercel domains inspect ${domain}`)

  // Parse verification TXT record if present
  const verificationMatch = inspectOutput.match(/TXT\s+_vercel\s+(\S+)/)
  const verification = verificationMatch?.[1]

  // 4. Configure Porkbun DNS
  console.log("\n--- Configuring Porkbun DNS ---")

  // Add verification TXT record if needed
  if (verification) {
    console.log(`Adding TXT record: _vercel -> ${verification}`)
    await porkbun(`/dns/create/${domain}`, {
      type: "TXT",
      name: "_vercel",
      content: verification,
    })
  }

  // Add CNAME for www
  console.log(`Adding CNAME: www -> cname.vercel-dns.com`)
  try {
    await porkbun(`/dns/create/${domain}`, {
      type: "CNAME",
      name: "www",
      content: "cname.vercel-dns.com",
    })
  } catch (e) {
    console.log("www CNAME may already exist, continuing...")
  }

  // Add A record for root (Vercel's IP)
  console.log(`Adding A record: @ -> 76.76.21.21`)
  try {
    await porkbun(`/dns/create/${domain}`, {
      type: "A",
      name: "",
      content: "76.76.21.21",
    })
  } catch (e) {
    console.log("A record may already exist, continuing...")
  }

  console.log("\n✅ Done! DNS changes may take a few minutes to propagate.")
  console.log(`   Check status: vercel domains inspect ${domain}`)
}

main().catch((e) => {
  console.error(`\n❌ Error: ${e.message}`)
  process.exit(1)
})
