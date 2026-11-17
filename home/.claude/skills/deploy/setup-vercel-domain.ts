#!/usr/bin/env -S npx tsx
/// <reference types="node" />

/*
 * Sets up a Vercel project for HerbCaudill/<name> on <name>.herbcaudill.com, with DNS on Porkbun.
 *
 * Usage: setup-vercel-domain [project-name] [--dry-run]
 *
 * Run it from ~/Code/HerbCaudill/<name>, or pass the name and it uses that checkout. It is safe to
 * re-run: each step reads the current state first and only changes what is missing.
 *
 * 1. Links the checkout to a Vercel project in the personal team, creating the project and
 *    connecting the GitHub repo. Keeps .gitignore free of the env patterns the CLI appends.
 * 2. Attaches the domain to the project through the API. herbcaudill.com is registered at Porkbun,
 *    so Vercel asks for a TXT record at _vercel.herbcaudill.com, which this adds and then verifies.
 * 3. Points a Porkbun CNAME at the CNAME Vercel recommends for the domain.
 * 4. Sets the Ignored Build Step guard so Beads/Dolt metadata branches never build.
 *
 * --dry-run reads everything and prints what it would change, without changing anything.
 *
 * Credentials: the Vercel token comes from the CLI's auth.json (run `vercel login`); the Porkbun
 * keys from PORKBUN_API_KEY and PORKBUN_SECRET_KEY, loaded from ~/.secrets if not set. Neither is
 * ever printed.
 */

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { guardGitignore } from "./scripts/guardGitignore.ts"
import { withMetadataBranchGuard } from "./scripts/withMetadataBranchGuard.ts"

/** Run the setup. */
const main = async () => {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const { name, dir } = resolveProject(args.find(arg => !arg.startsWith("--")))
  const domain = `${name}.${BASE_DOMAIN}`

  /** Perform a change, or only describe it in a dry run. */
  const change = async (
    /** What the change does, completing "would …". */
    description: string,
    /** The change itself. */
    action: () => unknown,
  ) => {
    if (dryRun) return console.log(`[dry run] Would ${description}`)
    console.log(`${description[0].toUpperCase()}${description.slice(1)}`)
    await action()
  }

  console.log(`\nSetting up ${domain} for ${GITHUB_ORG}/${name}${dryRun ? " (dry run)" : ""}\n`)
  const teamId = await getTeamId()

  // 1. Project
  console.log("--- Vercel project ---")
  let project = await findProject(name, teamId)
  await change(`run vercel link in ${dir}`, () => linkProject(name, dir))
  if (!dryRun) project = await findProject(name, teamId)
  if (project) {
    console.log(`Project ${project.name} (${project.id})`)
    const linked = project.link
    if (linked?.type !== "github" || linked.repo?.toLowerCase() !== name.toLowerCase()) {
      console.warn(`⚠️  The project is not connected to github.com/${GITHUB_ORG}/${name}.`)
      console.warn(`   Connect it under Settings › Git in the Vercel dashboard.`)
    }
  } else if (!dryRun) {
    throw new Error(`vercel link did not create a project named ${name}`)
  } else {
    console.log("[dry run] The project does not exist yet; later steps depend on it.")
    return
  }

  // 2. Domain
  console.log("\n--- Domain ---")
  let projectDomain = await findProjectDomain(project.id, domain, teamId)
  if (!projectDomain) {
    await change(`add ${domain} to the project`, async () => {
      projectDomain = await vercel<ProjectDomain>(`/v10/projects/${project.id}/domains`, teamId, {
        method: "POST",
        body: { name: domain },
      })
    })
  }
  if (!projectDomain) {
    console.log("[dry run] Would then add Vercel's TXT challenge to Porkbun and verify the domain")
  } else if (projectDomain.verified) {
    console.log(`${domain} is attached and verified`)
  } else {
    await verifyDomain(project.id, projectDomain, teamId, change)
  }

  // 3. DNS
  console.log("\n--- Porkbun CNAME ---")
  const recommended = await getRecommendedCnames(domain, teamId)
  const subdomain = name
  const existing = (await getDnsRecords()).find(
    record => record.name === domain && record.type === "CNAME",
  )
  const current = existing && stripDot(existing.content)
  if (current && recommended.includes(current)) {
    console.log(`CNAME ${subdomain} → ${current} is already a recommended value`)
  } else if (existing) {
    await change(`update CNAME ${subdomain} from ${current} to ${recommended[0]}`, () =>
      porkbun(`/dns/editByNameType/${BASE_DOMAIN}/CNAME/${subdomain}`, { content: recommended[0] }),
    )
  } else {
    await change(`create CNAME ${subdomain} → ${recommended[0]}`, () =>
      porkbun(`/dns/create/${BASE_DOMAIN}`, {
        type: "CNAME",
        name: subdomain,
        content: recommended[0],
      }),
    )
  }

  // 4. Ignored Build Step
  console.log("\n--- Ignored Build Step ---")
  const guarded = withMetadataBranchGuard(project.commandForIgnoringBuildStep)
  if (guarded === undefined) {
    console.log("Metadata branches are already skipped")
  } else {
    await change(`set the Ignored Build Step to: ${guarded}`, async () => {
      await vercel(`/v9/projects/${project.id}`, teamId, {
        method: "PATCH",
        body: { commandForIgnoringBuildStep: guarded },
      })
      const saved = await findProject(name, teamId)
      if (saved?.commandForIgnoringBuildStep !== guarded) {
        throw new Error("The Ignored Build Step did not save as expected")
      }
    })
  }

  console.log(`\n${dryRun ? "Dry run complete." : `Done. ${domain} is configured.`}`)
  if (!dryRun) {
    console.log("DNS changes can take a few minutes to propagate.")
    console.log(`Push to main, or run vercel --prod --yes, to deploy.`)
  }
}

// PROJECT

/** Work out the project name and its local checkout from the argument or the current directory. */
const resolveProject = (
  /** The project name passed on the command line, if any. */
  arg: string | undefined,
) => {
  const cwdMatch = process.cwd().match(/^(.*\/code\/herbcaudill\/([^/]+))/i)
  const name = arg ?? cwdMatch?.[2]
  if (!name) {
    console.error("Usage: setup-vercel-domain [project-name] [--dry-run]")
    console.error("Run from ~/Code/HerbCaudill/<project-name>, or pass the name.")
    process.exit(1)
  }
  const dir =
    cwdMatch && cwdMatch[2].toLowerCase() === name.toLowerCase()
      ? cwdMatch[1]
      : join(homedir(), "Code", GITHUB_ORG, name)
  if (!existsSync(join(dir, ".git"))) {
    throw new Error(`No git checkout at ${dir}; vercel link needs one`)
  }
  return { name, dir }
}

/**
 * Link the checkout with `vercel link`. `--repo` cannot create a project non-interactively, and
 * without `--scope` the CLI stops to ask which team to use.
 */
const linkProject = (
  /** The Vercel project name. */
  name: string,
  /** The local checkout. */
  dir: string,
) => {
  const gitignorePath = join(dir, ".gitignore")
  const before = readOptional(gitignorePath)
  execFileSync("vercel", ["link", "--yes", "--project", name, "--scope", TEAM_SLUG], {
    cwd: dir,
    stdio: "inherit",
  })
  const after = readOptional(gitignorePath)
  if (after === undefined || after === before) return

  const { content, dropped } = guardGitignore(before, after)
  writeFileSync(gitignorePath, content)
  if (dropped.length > 0) {
    console.warn(`⚠️  Removed entries vercel link added to .gitignore: ${dropped.join(", ")}`)
    console.warn("   They would have ignored committed files such as .env.example.")
  }
}

/** Look up a Vercel project by name, or undefined if there is none. */
const findProject = (
  /** The project name. */
  name: string,
  /** The team that owns it. */
  teamId: string,
) => vercelOptional<Project>(`/v9/projects/${name}`, teamId)

/** Find the personal team's ID. */
const getTeamId = async () => {
  const { teams } = await vercel<{ teams: { id: string; slug: string }[] }>("/v2/teams")
  const team = teams.find(team => team.slug === TEAM_SLUG)
  if (!team) throw new Error(`The Vercel account has no team named ${TEAM_SLUG}`)
  return team.id
}

// DOMAIN

/** Look up a domain attached to a project, or undefined if it is not attached. */
const findProjectDomain = (
  /** The project ID. */
  projectId: string,
  /** The full domain name. */
  domain: string,
  /** The team that owns the project. */
  teamId: string,
) => vercelOptional<ProjectDomain>(`/v9/projects/${projectId}/domains/${domain}`, teamId)

/**
 * Prove ownership of a domain registered outside Vercel: add each TXT challenge to Porkbun, then
 * ask Vercel to check, retrying while the record propagates.
 */
const verifyDomain = async (
  /** The project ID. */
  projectId: string,
  /** The unverified project domain, with its challenges. */
  projectDomain: ProjectDomain,
  /** The team that owns the project. */
  teamId: string,
  /** Performs or describes a change. */
  change: (description: string, action: () => unknown) => Promise<unknown>,
) => {
  const challenges = (projectDomain.verification ?? []).filter(v => v.type === "TXT")
  if (challenges.length === 0) {
    throw new Error(`${projectDomain.name} is unverified but Vercel gave no TXT challenge`)
  }

  const records = await getDnsRecords()
  for (const { domain, value } of challenges) {
    const present = records.some(
      record => record.type === "TXT" && record.name === domain && record.content === value,
    )
    if (present) {
      console.log(`TXT ${domain} challenge is already in Porkbun`)
      continue
    }
    // Other projects keep their own challenges at the same name, so add rather than replace.
    await change(`add TXT ${domain} = ${value}`, () =>
      porkbun(`/dns/create/${BASE_DOMAIN}`, {
        type: "TXT",
        name: relativeName(domain),
        content: value,
      }),
    )
  }

  await change(`ask Vercel to verify ${projectDomain.name}`, async () => {
    for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
      const result = await vercelResult<ProjectDomain>(
        `/v9/projects/${projectId}/domains/${projectDomain.name}/verify`,
        teamId,
        { method: "POST" },
      )
      if (result.ok && result.body.verified) return console.log("Verified")
      const reason = result.ok ? "not verified yet" : errorText(result)
      console.log(`Attempt ${attempt}/${VERIFY_ATTEMPTS}: ${reason}`)
      if (attempt < VERIFY_ATTEMPTS) await delay(VERIFY_INTERVAL_MS)
    }
    throw new Error(`${projectDomain.name} is still unverified; re-run once the TXT propagates`)
  })
}

/**
 * Get the CNAME targets Vercel recommends, best first. The domain config's `cnames` field is what
 * DNS currently returns, not a recommendation, so it is empty for a new domain.
 */
const getRecommendedCnames = async (
  /** The full domain name. */
  domain: string,
  /** The team that owns the domain's project. */
  teamId: string,
) => {
  const config = await vercel<DomainConfig>(`/v6/domains/${domain}/config`, teamId)
  const recommended = [...(config.recommendedCNAME ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map(({ value }) => stripDot(value))
  if (recommended.length === 0) throw new Error(`Vercel recommended no CNAME for ${domain}`)
  return recommended
}

// VERCEL API

/** Call the Vercel API and return the parsed body, throwing on any error. */
const vercel = async <T>(
  /** The API path. */
  path: string,
  /** The team to act as, if any. */
  teamId?: string,
  /** The request method and JSON body. */
  init?: RequestOptions,
) => {
  const result = await vercelResult<T>(path, teamId, init)
  if (!result.ok) throw new Error(`Vercel ${init?.method ?? "GET"} ${path}: ${errorText(result)}`)
  return result.body
}

/** Call the Vercel API and return the parsed body, or undefined if it is not found. */
const vercelOptional = async <T>(
  /** The API path. */
  path: string,
  /** The team to act as. */
  teamId: string,
) => {
  const result = await vercelResult<T>(path, teamId)
  if (result.status === 404) return undefined
  if (!result.ok) throw new Error(`Vercel GET ${path}: ${errorText(result)}`)
  return result.body
}

/** Call the Vercel API and return the status and parsed body without throwing. */
const vercelResult = async <T>(
  /** The API path. */
  path: string,
  /** The team to act as, if any. */
  teamId?: string,
  /** The request method and JSON body. */
  init: RequestOptions = {},
): Promise<VercelResult<T>> => {
  const url = new URL(path, VERCEL_API)
  if (teamId) url.searchParams.set("teamId", teamId)
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${getVercelToken()}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const body = await res.json().catch(() => ({}))
  return res.ok
    ? { ok: true, status: res.status, body: body as T }
    : { ok: false, status: res.status, error: body.error ?? {} }
}

/** Describe a failed Vercel response without anything secret. */
const errorText = (
  /** The failed response. */
  result: Extract<VercelResult<unknown>, { ok: false }>,
) => `${result.status} ${result.error.code ?? ""} ${result.error.message ?? ""}`.trim()

/** Read the Vercel CLI's token. */
const getVercelToken = () => {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN
  const authPath = join(homedir(), "Library/Application Support/com.vercel.cli/auth.json")
  const auth = readOptional(authPath)
  if (!auth) throw new Error("The Vercel CLI is not signed in. Run vercel login first.")
  return JSON.parse(auth).token as string
}

// PORKBUN API

/** Call the Porkbun API, throwing unless it succeeds. */
const porkbun = async (
  /** The API path. */
  endpoint: string,
  /** Request fields besides the credentials. */
  data: Record<string, string> = {},
) => {
  const res = await fetch(`${PORKBUN_API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getPorkbunCredentials(), ...data }),
  })
  const json = (await res.json()) as { status: string; message?: string }
  if (json.status !== "SUCCESS") throw new Error(`Porkbun ${endpoint}: ${json.message}`)
  return json
}

/** List the base domain's DNS records. Porkbun gives each name in full, e.g. `_vercel.herbcaudill.com`. */
const getDnsRecords = async () => {
  const { records } = (await porkbun(`/dns/retrieve/${BASE_DOMAIN}`)) as { records?: DnsRecord[] }
  return records ?? []
}

/** Read the Porkbun keys, loading ~/.secrets if they are not in the environment. */
const getPorkbunCredentials = () => {
  if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) loadSecrets()
  const apikey = process.env.PORKBUN_API_KEY
  const secretapikey = process.env.PORKBUN_SECRET_KEY
  if (!apikey || !secretapikey) throw new Error("Missing PORKBUN_API_KEY or PORKBUN_SECRET_KEY")
  return { apikey, secretapikey }
}

/** Copy `export KEY=value` lines from ~/.secrets into the environment without overriding it. */
const loadSecrets = () => {
  const content = readOptional(join(homedir(), ".secrets")) ?? ""
  for (const line of content.split("\n")) {
    const match = line.match(/^export\s+(\w+)=["']?([^"'\n]+)["']?/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

// UTILITIES

/** Read a file, or undefined if it does not exist. */
const readOptional = (
  /** The file path. */
  path: string,
) => (existsSync(path) ? readFileSync(path, "utf-8") : undefined)

/** Turn a full DNS name into the subdomain part Porkbun expects, e.g. `_vercel`. */
const relativeName = (
  /** A full name under the base domain. */
  name: string,
) => (name === BASE_DOMAIN ? "" : name.slice(0, -`.${BASE_DOMAIN}`.length))

/** Remove a DNS name's trailing dot. */
const stripDot = (
  /** A DNS name. */
  name: string,
) => name.replace(/\.$/, "")

/** Wait for a number of milliseconds. */
const delay = (
  /** How long to wait. */
  ms: number,
) => new Promise(resolve => setTimeout(resolve, ms))

// CONSTANTS

/** The Porkbun API base URL. */
const PORKBUN_API = "https://api.porkbun.com/api/json/v3"

/** The Vercel API base URL. */
const VERCEL_API = "https://api.vercel.com"

/** The domain whose subdomains host the projects. */
const BASE_DOMAIN = "herbcaudill.com"

/** The GitHub owner of the repositories. */
const GITHUB_ORG = "HerbCaudill"

/** The Vercel team for personal projects; the account also belongs to dev-results. */
const TEAM_SLUG = "herb-caudills-projects"

/** How many times to ask Vercel to verify the domain. */
const VERIFY_ATTEMPTS = 8

/** How long to wait between verification attempts. */
const VERIFY_INTERVAL_MS = 15_000

// TYPES

/** The fields used from a Vercel project. */
type Project = {
  /** The project ID. */
  id: string
  /** The project name. */
  name: string
  /** The connected Git repository, if any. */
  link?: { type: string; org?: string; repo?: string }
  /** The Ignored Build Step command, if any. */
  commandForIgnoringBuildStep?: string | null
}

/** The fields used from a domain attached to a Vercel project. */
type ProjectDomain = {
  /** The full domain name. */
  name: string
  /** Whether Vercel has confirmed the account owns the domain. */
  verified: boolean
  /** DNS challenges to complete before Vercel will verify the domain. */
  verification?: { type: string; domain: string; value: string; reason: string }[]
}

/** The fields used from Vercel's domain configuration. */
type DomainConfig = {
  /** Recommended CNAME targets; a lower rank is preferred. */
  recommendedCNAME?: { rank: number; value: string }[]
}

/** A Porkbun DNS record. */
type DnsRecord = {
  /** The full record name. */
  name: string
  /** The record type. */
  type: string
  /** The record value. */
  content: string
}

/** A Vercel API request's method and JSON body. */
type RequestOptions = {
  /** The HTTP method. */
  method?: string
  /** The JSON body. */
  body?: unknown
}

/** A Vercel API response. */
type VercelResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: { code?: string; message?: string } }

main().catch(e => {
  console.error(`\n❌ ${e.message}`)
  process.exit(1)
})
