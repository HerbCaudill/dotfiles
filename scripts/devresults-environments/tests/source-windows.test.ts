import { mkdtemp, realpath, mkdir, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { expect, it } from "vitest"
import { createRegistry } from "../createRegistry.ts"
import { pairEnvironmentSource } from "../pairEnvironmentSource.ts"
import { syncEnvironmentSource } from "../syncEnvironmentSource.ts"
import { runDrenvCommand } from "../runDrenvCommand.ts"

/** Invoke fixed test fixture code over SSH with separately encoded data. */
async function windows(script: string, data: unknown) {
  return runDrenvCommand({
    executable: "ssh",
    args: [
      "devresults-vm",
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(
        "$d = [Console]::In.ReadToEnd() | ConvertFrom-Json; " + script,
        "utf16le",
      ).toString("base64"),
    ],
    input: JSON.stringify(data),
  })
}

it.skipIf(process.env.DRENV_WINDOWS_SOURCE_TEST !== "1")(
  "pairs and syncs native Windows worktrees and refuses dirty or foreign destinations",
  async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "drenv-source-live-")))
    const source = join(root, "source")
    await mkdir(source)
    const git = async (...args: string[]) =>
      (await runDrenvCommand({ executable: "git", args, cwd: source })).stdout.trim()
    const id = `source-proof-${randomUUID().slice(0, 8)}`
    const registry = createRegistry({
      directory: join(root, "registry"),
      macRoot: join(root, "worktrees"),
      windowsRoot: "C:\\DevResultsEnvironments",
      windowsHost: "devresults-vm",
    })
    const manifest = await registry.reserve({ id, inventory: { windowsPorts: [], macPorts: [] } })
    try {
      await git("init")
      await git("config", "user.name", "Codex test")
      await git("config", "user.email", "codex@localhost")
      await writeFile(join(source, "test.txt"), "first")
      await git("add", ".")
      await git("commit", "-m", "fixture")
      const first = await pairEnvironmentSource(manifest, source)
      expect(await pairEnvironmentSource(manifest, source)).toBe(first)
      await windows('[IO.File]::WriteAllText((Join-Path $d.path "untracked.txt"), "preserve")', {
        path: manifest.paths.windows,
      })
      await expect(syncEnvironmentSource(manifest)).rejects.toThrow("dirty")
      await windows('Remove-Item -LiteralPath (Join-Path $d.path "untracked.txt")', {
        path: manifest.paths.windows,
      })
      await writeFile(join(manifest.paths.mac, "test.txt"), "second")
      await runDrenvCommand({
        executable: "git",
        args: ["-C", manifest.paths.mac, "commit", "-am", "next"],
      })
      const second = await syncEnvironmentSource(manifest)
      expect(second).not.toBe(first)
      expect(
        (
          await windows("git -C $d.path rev-parse HEAD", { path: manifest.paths.windows })
        ).stdout.trim(),
      ).toBe(second)
      expect(await readFile(join(source, "test.txt"), "utf8")).toBe("first")
      // Simulate interruption between a verified merge and persistence of its source receipt.
      await windows(
        '$p = "$($d.path).drenv-source\\owner.json"; $r = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json; $r.syncedRevision = $d.first; [IO.File]::WriteAllText($p, ($r | ConvertTo-Json -Compress))',
        { path: manifest.paths.windows, first },
      )
      expect(await syncEnvironmentSource(manifest)).toBe(second)
      await windows(
        '$p = "$($d.path).drenv-source\\owner.json"; $r = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json; $r.ownerToken = "foreign"; [IO.File]::WriteAllText($p, ($r | ConvertTo-Json -Compress))',
        { path: manifest.paths.windows },
      )
      await expect(syncEnvironmentSource(manifest)).rejects.toThrow("foreign")
      await windows(
        '$p = "$($d.path).drenv-source\\owner.json"; $r = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json; $r.ownerToken = $d.ownerToken; [IO.File]::WriteAllText($p, ($r | ConvertTo-Json -Compress))',
        { path: manifest.paths.windows, ownerToken: manifest.ownerToken },
      )
      await windows(
        'git -C $d.path -c user.name="Codex test" -c user.email=codex@localhost commit --allow-empty -m "foreign fixture commit"',
        { path: manifest.paths.windows },
      )
      const foreignHead = (
        await windows("git -C $d.path rev-parse HEAD", { path: manifest.paths.windows })
      ).stdout.trim()
      await expect(syncEnvironmentSource(manifest)).rejects.toThrow("HEAD changed")
      expect(
        (
          await windows("git -C $d.path rev-parse HEAD", { path: manifest.paths.windows })
        ).stdout.trim(),
      ).toBe(foreignHead)
    } finally {
      // Only this run's synthetic fixture is removed; no application checkout or runtime is touched.
      await windows(
        '$c = "$($d.path).drenv-source"; if (Test-Path -LiteralPath "$c\\owner.json") { $r = Get-Content -LiteralPath "$c\\owner.json" -Raw | ConvertFrom-Json; if ($r.ownerToken -ceq $d.ownerToken -and $r.path -ceq $d.path -and $r.environmentId -ceq $d.id -and $d.id -like "source-proof-*") { if (Test-Path -LiteralPath $d.path) { git -C "$c\\repository.git" worktree remove --force -- $d.path }; Remove-Item -LiteralPath $c -Recurse -Force } }',
        { path: manifest.paths.windows, ownerToken: manifest.ownerToken, id },
      )
      await rm(root, { recursive: true, force: true })
    }
  },
  120_000,
)
