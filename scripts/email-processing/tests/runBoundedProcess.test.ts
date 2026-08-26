import { access, chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { runBoundedProcess } from "../runBoundedProcess.ts"

describe("runBoundedProcess", () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })),
    )
  })

  it("captures a successful process result", async () => {
    const result = await runBoundedProcess({
      command: process.execPath,
      args: ["-e", 'process.stdin.pipe(process.stdout); process.stderr.write("notice")'],
      cwd: process.cwd(),
      env: {},
      stdin: "classifier input",
      timeoutMs: 1_000,
      maxOutputBytes: 1_000,
    })

    expect(result).toEqual({ code: 0, stdout: "classifier input", stderr: "notice" })
  })

  it("kills a process that exceeds its deadline", async () => {
    await expect(
      runBoundedProcess({
        command: process.execPath,
        args: ["-e", "setInterval(() => {}, 1_000)"],
        cwd: process.cwd(),
        env: {},
        stdin: "",
        timeoutMs: 20,
        maxOutputBytes: 1_000,
      }),
    ).rejects.toThrow("timed out")
  })

  it("kills a process whose combined output exceeds the limit", async () => {
    await expect(
      runBoundedProcess({
        command: process.execPath,
        args: ["-e", 'process.stdout.write("x".repeat(101))'],
        cwd: process.cwd(),
        env: {},
        stdin: "",
        timeoutMs: 1_000,
        maxOutputBytes: 100,
      }),
    ).rejects.toThrow("output limit")
  })

  it("kills descendants when a timed-out command created them", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bounded-process-test-"))
    temporaryDirectories.push(directory)
    const markerPath = join(directory, "descendant-finished")
    const scriptPath = join(directory, "spawn-descendant.sh")
    await writeFile(scriptPath, `#!/bin/sh\n(sleep 0.2; touch "$1") &\nsleep 10\n`, "utf8")
    await chmod(scriptPath, 0o700)

    await expect(
      runBoundedProcess({
        command: scriptPath,
        args: [markerPath],
        cwd: directory,
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
        stdin: "",
        timeoutMs: 20,
        maxOutputBytes: 1_000,
      }),
    ).rejects.toThrow("timed out")

    await new Promise(resolve => setTimeout(resolve, 300))
    await expect(access(markerPath)).rejects.toThrow()
  })
})
