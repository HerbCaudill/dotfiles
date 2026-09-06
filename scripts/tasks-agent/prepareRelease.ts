import { createHash, randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { runReleaseCommand } from "./runReleaseCommand.ts"
import { privateDirectory } from "./privateDirectory.ts"

/** Install one exact Git commit in isolation without changing the selected release or service. */
export async function prepareRelease(
  /** Explicit source, commit and private installation root. */
  options: {
    /** Local Tasks repository containing the approved commit. */
    repo: string
    /** Full immutable commit SHA, never HEAD or a branch name. */
    revision: string
    /** Private installation parent containing releases/ and current. */
    root: string
    /** Managed pnpm executable. */
    pnpm: string
    /** Command boundary for isolated verification. */
    run?: typeof runReleaseCommand
  },
) {
  if (!/^[a-f0-9]{40}$/.test(options.revision)) throw new Error("A full commit SHA is required.")
  const run = options.run ?? runReleaseCommand
  const repo = resolve(options.repo)
  const actual = (await run("git", ["rev-parse", `${options.revision}^{commit}`], repo)).trim()
  if (actual !== options.revision) throw new Error("The requested commit could not be verified.")
  const root = resolve(options.root)
  await mkdir(root, { recursive: true, mode: 0o700 })
  await privateDirectory(root)
  const releases = join(root, "releases")
  await mkdir(releases, { recursive: true, mode: 0o700 })
  await privateDirectory(releases)
  const path = join(releases, options.revision)
  if (
    await lstat(path).then(
      () => true,
      error => {
        if (error.code !== "ENOENT") throw error
        return false
      },
    )
  )
    throw new Error("This release already exists; it will not be overwritten.")
  const staging = join(releases, `.prepare-${options.revision}-${randomUUID()}`)
  await mkdir(staging, { mode: 0o700 })
  const archive = join(releases, `.archive-${randomUUID()}.tar`)
  await run("git", ["archive", "--format=tar", `--output=${archive}`, options.revision], repo)
  await run("tar", ["-xf", archive, "-C", staging], repo)
  await unlink(archive)
  const manifest = JSON.parse(await readFile(join(staging, "package.json"), "utf8"))
  if (!/^pnpm@\d+\.\d+\.\d+$/.test(manifest.packageManager))
    throw new Error("The release must pin an exact pnpm version.")
  const pnpmVersion = (await run(options.pnpm, ["--version"], staging)).trim()
  if (manifest.packageManager !== `pnpm@${pnpmVersion}`)
    throw new Error("The managed pnpm did not select the release's pinned version.")
  await run(options.pnpm, ["install", "--frozen-lockfile", "--prod=false"], staging)
  if (!(await lstat(join(staging, "node_modules"))).isDirectory())
    throw new Error("The release must own its node_modules directory.")
  await run(process.execPath, ["--import", "tsx", "src/agent/service/main.ts", "--help"], staging)
  await run(process.execPath, ["--import", "tsx", "src/agent/cli/main.ts", "--help"], staging)
  const release = {
    version: 1,
    revision: options.revision,
    node: process.version,
    packageManager: manifest.packageManager,
    lockHash: createHash("sha256")
      .update(await readFile(join(staging, "pnpm-lock.yaml")))
      .digest("hex"),
    preparedAt: new Date().toISOString(),
  }
  await writeFile(join(staging, "release.json"), JSON.stringify(release) + "\n", {
    flag: "wx",
    mode: 0o600,
  })
  await rename(staging, path)
  return { path, ...release }
}
