import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { runDrenvCommand } from "../runDrenvCommand.ts"
import { withRegistryLock } from "../withRegistryLock.ts"

it("passes arguments literally and input privately without shell evaluation", async () => {
  const literal = "$(echo bad); ' \" `"
  const result = await runDrenvCommand({
    executable: process.execPath,
    args: [
      "-e",
      "process.stdout.write(process.argv[1]);process.stdin.pipe(process.stdout)",
      literal,
    ],
    input: "private stdin",
  })
  expect(result.stdout).toBe(literal + "private stdin")
})

it("does not include command output or input in failed command errors", async () => {
  await expect(
    runDrenvCommand({
      executable: process.execPath,
      args: ["-e", "console.error('secret');process.exit(3)"],
      input: "password",
    }),
  ).rejects.toThrow("Command failed (exit 3)")
  try {
    await runDrenvCommand({
      executable: process.execPath,
      args: ["-e", "console.error('secret');process.exit(3)"],
    })
  } catch (error) {
    expect(String(error)).not.toContain("secret")
  }
})

it("refuses an unrecovered lock rather than stealing it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-lock-"))
  try {
    await mkdir(join(directory, "registry.lock"))
    await expect(withRegistryLock(directory, async () => "unexpected", 1)).rejects.toThrow(
      "locks are never stolen automatically",
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it("releases the registry lock after an operation fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "drenv-lock-"))
  try {
    await expect(
      withRegistryLock(directory, async () => {
        throw new Error("interrupted")
      }),
    ).rejects.toThrow("interrupted")
    expect(await withRegistryLock(directory, async () => "retry")).toBe("retry")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
