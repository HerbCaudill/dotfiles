import { execFileSync, spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, test } from "vitest"

import { runConvergePlans } from "../runConvergePlans.ts"

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach(directory => rmSync(directory, { force: true, recursive: true }))
})

describe("runConvergePlans", () => {
  test("exposes the workflow through the TypeScript CLI", () => {
    const repository = createRepository()
    const cli = join(dirname(fileURLToPath(import.meta.url)), "../converge-plans.ts")

    const output = execFileSync(
      process.execPath,
      [cli, "init", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: repository, encoding: "utf8" },
    )

    expect(JSON.parse(output)).toMatchObject({
      branch: "plan-014",
      planDirectory: "plans/014-detail-forms",
    })
  })

  test("creates and resumes one plan worktree whose branch starts at main", () => {
    const repository = createRepository()
    const mainCommit = git(repository, "rev-parse", "main")

    const first = runConvergePlans(["init", "plans/014-detail-forms", "--participant", "claude"], {
      cwd: repository,
    })
    const second = runConvergePlans(["init", "plans/014-detail-forms", "--participant", "codex"], {
      cwd: repository,
    })

    expect(second.worktree).toBe(first.worktree)
    expect(git(first.worktree, "branch", "--show-current")).toBe("plan-014")
    expect(git(first.worktree, "merge-base", "plan-014", "main")).toBe(mainCommit)
    expect(readState(first.worktree).participants).toMatchObject({
      claude: { status: "active" },
      codex: { status: "active" },
    })
  })

  test("serializes simultaneous initialization onto one worktree", async () => {
    const repository = createRepository()
    const [claude, codex] = await Promise.all([
      runCli(repository, "claude"),
      runCli(repository, "codex"),
    ])

    expect(claude.worktree).toBe(codex.worktree)
    expect(readState(claude.worktree).participants).toMatchObject({
      claude: { status: "active" },
      codex: { status: "active" },
    })
  })

  test("publishes a valid immutable artifact and checkpoints it", () => {
    const repository = createRepository()
    const { worktree } = runConvergePlans(
      ["init", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: repository },
    )
    const source = writeTemporaryFile(validDraft())

    runConvergePlans(
      ["publish", "plans/014-detail-forms", "--participant", "claude", "--file", source],
      { cwd: worktree },
    )

    const destination = join(worktree, "plans/014-detail-forms/convergence/claude/draft-001.md")
    expect(readFileSync(destination, "utf8")).toBe(validDraft())
    expect(git(worktree, "status", "--short")).toBe("")
    expect(git(worktree, "log", "-1", "--pretty=%s")).toContain("claude draft 001")
    expect(() =>
      runConvergePlans(
        ["publish", "plans/014-detail-forms", "--participant", "claude", "--file", source],
        { cwd: worktree },
      ),
    ).toThrow("already exists")
  })

  test("check rejects writes outside the convergence protocol", () => {
    const repository = createRepository()
    const { worktree } = runConvergePlans(
      ["init", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: repository },
    )

    writeFileSync(join(worktree, "README.md"), "uncoordinated change\n")

    expect(() =>
      runConvergePlans(["check", "plans/014-detail-forms", "--participant", "claude"], {
        cwd: worktree,
      }),
    ).toThrow("README.md")
  })

  test("check requires invocation from the shared worktree", () => {
    const repository = createRepository()
    runConvergePlans(["init", "plans/014-detail-forms", "--participant", "claude"], {
      cwd: repository,
    })

    expect(() =>
      runConvergePlans(["check", "plans/014-detail-forms", "--participant", "claude"], {
        cwd: repository,
      }),
    ).toThrow("shared worktree")
  })

  test("check rejects unregistered protocol-owned files", () => {
    const repository = createRepository()
    const { worktree } = runConvergePlans(
      ["init", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: repository },
    )
    writeFileSync(
      join(worktree, "plans/014-detail-forms/convergence/.protocol/manual.json"),
      "{}\n",
    )

    expect(() =>
      runConvergePlans(["check", "plans/014-detail-forms", "--participant", "claude"], {
        cwd: worktree,
      }),
    ).toThrow("manual.json")
  })

  test("check rejects an artifact changed after publication", () => {
    const repository = createRepository()
    const { worktree } = runConvergePlans(
      ["init", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: repository },
    )
    const source = writeTemporaryFile(validDraft())
    runConvergePlans(
      ["publish", "plans/014-detail-forms", "--participant", "claude", "--file", source],
      { cwd: worktree },
    )
    writeFileSync(
      join(worktree, "plans/014-detail-forms/convergence/claude/draft-001.md"),
      validDraft().replace("The goal.", "Changed."),
    )

    expect(() =>
      runConvergePlans(["check", "plans/014-detail-forms", "--participant", "claude"], {
        cwd: worktree,
      }),
    ).toThrow("changed after publication")
  })

  test("requires converged response evidence before recording convergence", () => {
    const repository = createRepository()
    const { worktree } = runConvergePlans(
      ["init", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: repository },
    )

    expect(() =>
      runConvergePlans(
        ["status", "plans/014-detail-forms", "--participant", "claude", "--status", "converged"],
        { cwd: worktree },
      ),
    ).toThrow("converged responses")
    expect(() =>
      runConvergePlans(
        ["status", "plans/014-detail-forms", "--participant", "claude", "--status", "complete"],
        { cwd: worktree },
      ),
    ).toThrow("Invalid --status")
  })

  test("selects one finalizer and exports only plan.md onto main", () => {
    const repository = createRepository()
    const { worktree } = runConvergePlans(
      ["init", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: repository },
    )
    runConvergePlans(["init", "plans/014-detail-forms", "--participant", "codex"], {
      cwd: repository,
    })
    publish(worktree, "claude", validDraftFor("claude"))
    publish(worktree, "codex", validDraftFor("codex"))
    publish(worktree, "claude", validResponseFor("claude"))
    publish(worktree, "codex", validResponseFor("codex"))
    setStatus(worktree, "claude", "converged")
    setStatus(worktree, "codex", "converged")
    runConvergePlans(["init", "plans/014-detail-forms", "--participant", "claude"], {
      cwd: repository,
    })
    expect(readState(worktree).participants.claude.status).toBe("converged")

    const winner = runConvergePlans(
      ["claim-finalizer", "plans/014-detail-forms", "--participant", "claude"],
      { cwd: worktree },
    )
    const loser = runConvergePlans(
      ["claim-finalizer", "plans/014-detail-forms", "--participant", "codex"],
      { cwd: worktree },
    )

    expect(winner).toMatchObject({ finalizer: { won: true } })
    expect(loser).toMatchObject({ finalizer: { won: false } })
    expect(readState(worktree).participants.codex.status).toBe("stopped")
    expect(() => publish(worktree, "claude", validDraftFor("claude"))).toThrow(
      "closed artifact publication",
    )

    const source = writeTemporaryFile(finalPlan())
    const mainBefore = git(repository, "rev-parse", "main")
    runConvergePlans(
      ["finalize", "plans/014-detail-forms", "--participant", "claude", "--file", source],
      { cwd: worktree },
    )

    const mainAfter = git(repository, "rev-parse", "main")
    expect(mainAfter).not.toBe(mainBefore)
    expect(git(repository, "diff", "--name-only", `${mainBefore}..${mainAfter}`)).toBe(
      "plans/014-detail-forms/plan.md",
    )
    expect(git(repository, "ls-tree", "-r", "--name-only", "main")).not.toContain("convergence/")
    expect(git(worktree, "ls-tree", "-r", "--name-only", "plan-014")).toContain(
      "convergence/claude/draft-001.md",
    )
    expect(readState(worktree).finalCommit).toBe(mainAfter)
  }, 15_000)
})

/** Create a temporary Git repository with a main branch and one committed file. */
function createRepository() {
  const repository = mkdtempSync(join(tmpdir(), "converge-plans-test-"))
  temporaryDirectories.push(
    repository,
    join(dirname(repository), `.${repository.split("/").at(-1)}-worktrees`),
  )
  execFileSync("git", ["init", "-b", "main", repository])
  git(repository, "config", "user.name", "Test Agent")
  git(repository, "config", "user.email", "test@example.com")
  git(repository, "config", "commit.gpgSign", "false")
  writeFileSync(join(repository, "README.md"), "original\n")
  git(repository, "add", "README.md")
  git(repository, "commit", "-m", "Initial commit")
  return repository
}

/** Run the real CLI asynchronously for lock-contention tests. */
function runCli(repository: string, participant: "claude" | "codex") {
  const cli = join(dirname(fileURLToPath(import.meta.url)), "../converge-plans.ts")
  return new Promise<{ worktree: string }>((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [cli, "init", "plans/014-detail-forms", "--participant", participant],
      { cwd: repository },
    )
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", chunk => (stdout += String(chunk)))
    child.stderr.on("data", chunk => (stderr += String(chunk)))
    child.on("close", code => {
      if (code === 0) resolvePromise(JSON.parse(stdout))
      else rejectPromise(new Error(stderr))
    })
  })
}

/** Run Git in a repository and return trimmed stdout. */
function git(repository: string, ...args: string[]) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout.trim()
}

/** Read the protocol state for the test run. */
function readState(worktree: string) {
  return JSON.parse(
    readFileSync(join(worktree, "plans/014-detail-forms/convergence/.protocol/state.json"), "utf8"),
  )
}

/** Write an artifact source outside the repository. */
function writeTemporaryFile(contents: string) {
  const directory = mkdtempSync(join(tmpdir(), "converge-plans-artifact-"))
  temporaryDirectories.push(directory)
  const path = join(directory, "artifact.md")
  writeFileSync(path, contents)
  return path
}

/** Publish an artifact through the helper. */
function publish(worktree: string, participant: "claude" | "codex", contents: string) {
  runConvergePlans(
    [
      "publish",
      "plans/014-detail-forms",
      "--participant",
      participant,
      "--file",
      writeTemporaryFile(contents),
    ],
    { cwd: worktree },
  )
}

/** Record one participant's protocol status. */
function setStatus(worktree: string, participant: "claude" | "codex", status: "converged") {
  runConvergePlans(
    ["status", "plans/014-detail-forms", "--participant", participant, "--status", status],
    { cwd: worktree },
  )
}

/** Build a valid initial Claude draft. */
function validDraft() {
  return `<!-- converge-plans:artifact run=014-detail-forms author=claude kind=draft sequence=001 -->
# Detail forms

## Goal

The goal.

## Approach

The approach.

## Tasks

1. Do the work.

## Unresolved questions

None.
<!-- converge-plans:eof run=014-detail-forms author=claude kind=draft sequence=001 -->
`
}

/** Build a valid first draft for either participant. */
function validDraftFor(participant: "claude" | "codex") {
  return validDraft().replaceAll("author=claude", `author=${participant}`)
}

/** Build a valid converged first-round response for either participant. */
function validResponseFor(participant: "claude" | "codex") {
  const peer = participant === "claude" ? "codex" : "claude"
  const peerTitle = participant === "claude" ? "Codex" : "Claude"
  return `<!-- converge-plans:artifact run=014-detail-forms author=${participant} kind=response sequence=001 own-draft=${participant}/draft-001.md responds-to=${peer}/draft-001.md verdict=converged -->
# Response to ${peerTitle} draft 001

## Improvements to absorb

None.

## Suggestions not accepted

None.

## Remaining material differences

None.

## Verdict

\`converged\`
<!-- converge-plans:eof run=014-detail-forms author=${participant} kind=response sequence=001 own-draft=${participant}/draft-001.md responds-to=${peer}/draft-001.md verdict=converged -->
`
}

/** Build the final plan body without convergence metadata. */
function finalPlan() {
  return `# Detail forms

## Goal

The goal.

## Approach

The agreed approach.

## Tasks

1. Do the work.

## Unresolved questions

None.
`
}
