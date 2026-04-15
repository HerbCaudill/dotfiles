/**
 * Shared sprite setup logic: checks gh auth, resolves sprite name from args or
 * git remote, creates the sprite, and runs setup-sprite.ts remotely.
 */

import { execSync } from "node:child_process"

/** Create and set up a sprite, returning the resolved sprite name. */
export const spSetup = (
  /** Optional sprite name; auto-detected from git remote if omitted. */
  name,
) => {
  const ghToken = run("gh auth token").trim()
  if (!ghToken) {
    console.error("Not authenticated with gh - run 'gh auth login' first")
    process.exit(1)
  }

  let spriteName = name ?? ""
  let repoUser = ""
  let repoName = ""

  // If no name given and we're at a git repo root without .sprite file, use repo name
  if (!spriteName && isGitRoot() && !fileExists(".sprite")) {
    const remoteUrl = tryRun("git remote get-url origin")
    if (remoteUrl) {
      const repoPath = remoteUrl
        .replace(/.*github\.com[:/]/, "")
        .replace(/\.git$/, "")
        .trim()
      repoName = repoPath.split("/").pop() ?? ""
      repoUser = repoPath.split("/").slice(0, -1).join("/")
      spriteName = `dev-${repoName}`
    }
  }

  // Fall back to random 5-char name
  if (!spriteName) {
    spriteName = randomAlpha(5)
  }

  // Check if sprite already exists
  const existing = run("sprite list").trim()
  if (existing.split("\n").includes(spriteName)) {
    console.log(`Sprite '${spriteName}' already exists`)
    return spriteName
  }

  // Create the sprite
  const createOutput = run(`sprite create --skip-console ${spriteName}`)
  console.log(createOutput.split("\n")[0])

  if (repoUser) {
    const useOutput = run(`sprite use ${spriteName}`)
    console.log(useOutput.split("\n")[0])
  }

  // Run setup-sprite.ts remotely
  const envVars = [
    `GITHUB_TOKEN='${ghToken}'`,
    `SPRITE_NAME='${spriteName}'`,
    `REPO_USER='${repoUser}'`,
    `REPO_NAME='${repoName}'`,
  ].join(" ")

  execSync(
    `sprite exec -s ${spriteName} bash -c "export ${envVars}; curl -fsSL https://raw.githubusercontent.com/HerbCaudill/dotfiles/main/scripts/setup-sprite.ts | npm_config_update_notifier=false npx -y tsx -"`,
    { stdio: "inherit" },
  )

  return spriteName
}

/** Execute a shell command, returning stdout as a string. */
const run = cmd => {
  return execSync(cmd, { stdio: "pipe", encoding: "utf-8" })
}

/** Execute a shell command, returning stdout or empty string on failure. */
const tryRun = cmd => {
  try {
    return run(cmd).trim()
  } catch {
    return ""
  }
}

/** Check if the current directory is a git repo root. */
const isGitRoot = () => {
  try {
    execSync("test -d .git", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/** Check if a file exists in the current directory. */
const fileExists = path => {
  try {
    execSync(`test -f ${path}`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

/** Generate a random lowercase alphabetic string. */
const randomAlpha = length => {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}
