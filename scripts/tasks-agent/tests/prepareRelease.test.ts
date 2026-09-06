import { expect, test } from "vitest"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { prepareRelease } from "../prepareRelease.ts"

const exec = promisify(execFile)

test("prepares the exact committed source with isolated dependencies without selecting it", async () => {
  const root = await mkdtemp(join(tmpdir(), "tasks-release-"))
  const repo = join(root, "repo")
  const installRoot = join(root, "installed")
  try {
    await mkdir(repo)
    await exec("git", ["init", "--quiet", repo])
    await writeFile(join(repo, "package.json"), JSON.stringify({ packageManager: "pnpm@11.25.0" }))
    await writeFile(join(repo, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n")
    await writeFile(join(repo, "source.txt"), "committed")
    await exec("git", ["-C", repo, "add", "."])
    await exec("git", [
      "-C",
      repo,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@localhost",
      "commit",
      "--quiet",
      "-m",
      "Fixture",
    ])
    const revision = (await exec("git", ["-C", repo, "rev-parse", "HEAD"])).stdout.trim()
    await writeFile(join(repo, "source.txt"), "uncommitted")
    const result = await prepareRelease({
      repo,
      revision,
      root: installRoot,
      pnpm: "fixture-pnpm",
      run: async (command, args, cwd) => {
        if (command !== "fixture-pnpm" && command !== process.execPath)
          return (await exec(command, args, { cwd })).stdout
        if (args[0] === "--version") return "11.25.0\n"
        if (args[0] === "install") {
          expect(args).toContain("--frozen-lockfile")
          await mkdir(join(cwd, "node_modules"))
        }
        return ""
      },
    })
    expect(await readFile(join(result.path, "source.txt"), "utf8")).toBe("committed")
    expect(JSON.parse(await readFile(join(result.path, "release.json"), "utf8")).revision).toBe(
      revision,
    )
    await expect(readFile(join(installRoot, "current"))).rejects.toThrow("ENOENT")
    await expect(
      prepareRelease({ repo, revision: "HEAD", root: installRoot, pnpm: "fixture-pnpm" }),
    ).rejects.toThrow("full commit")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
