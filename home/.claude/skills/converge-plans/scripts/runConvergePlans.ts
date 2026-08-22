import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import type { ParsedArtifact, Participant, ProtocolState } from "./types.ts"
import { claimFinalizer } from "./claimFinalizer.ts"
import { validateArtifact } from "./validateArtifact.ts"

/** Run one converge-plans command. */
export function runConvergePlans(
  /** Command-line arguments after the executable name. */
  args: string[],
  /** Runtime values supplied by the CLI or a test. */
  options: {
    /** Directory from which the command was invoked. */
    cwd: string
  },
): CommandResult {
  const parsed = parseArguments(args)
  if (parsed.command === "init") return initialize(parsed, options.cwd)

  const context = loadContext(parsed.planDirectory, options.cwd)
  if (parsed.command === "check") {
    checkWorkspace(context)
    return resultFor(context)
  }
  if (parsed.command === "publish") {
    return withLock(context, () => publishArtifact(context, parsed))
  }
  if (parsed.command === "status") {
    if (!parsed.status) {
      checkWorkspace(context)
      return { ...resultFor(context), state: readState(context) }
    }
    return withLock(context, () => recordStatus(context, parsed))
  }
  if (parsed.command === "claim-finalizer") {
    return withLock(context, () => claimFinalization(context, parsed))
  }
  if (parsed.command === "finalize") {
    return withLock(context, () => finalizePlan(context, parsed))
  }

  throw new Error(`Command ${parsed.command} is not implemented`)
}

/** Record a participant status after checking terminal-state evidence. */
function recordStatus(context: Context, args: ParsedArguments) {
  checkWorkspace(context)
  const participant = requireParticipant(args.participant)
  const status = requireStatus(args.status)
  const state = readState(context)
  if (state.finalizer && status !== "stopped") {
    throw new Error("Finalizer selection has closed convergence status updates")
  }
  if (status === "converged") assertConvergedEvidence(state)
  if (status === "round-limit") assertRoundLimitEvidence(state)

  const timestamp = new Date().toISOString()
  state.participants[participant] = {
    status,
    updatedAt: timestamp,
    ...(args.reason ? { reason: args.reason } : {}),
  }
  state.updatedAt = timestamp
  writeState(context, state)
  checkpoint(context, `converge-plans: record ${participant} ${status}`)
  checkWorkspace(context)
  return { ...resultFor(context), state }
}

/** Select or recover the single finalizer under the repository lock. */
function claimFinalization(context: Context, args: ParsedArguments) {
  checkWorkspace(context)
  const participant = requireParticipant(args.participant)
  const result = claimFinalizer(readState(context), participant, new Date())
  if (result.won) {
    writeState(context, result.state)
    checkpoint(
      context,
      result.recovered
        ? `converge-plans: recover finalizer claim for ${participant}`
        : `converge-plans: select ${participant} as finalizer`,
    )
  }
  checkWorkspace(context)
  return { ...resultFor(context), finalizer: { recovered: result.recovered, won: result.won } }
}

/** Export only the final plan in a new commit based directly on current main. */
function finalizePlan(context: Context, args: ParsedArguments) {
  checkWorkspace(context)
  const participant = requireParticipant(args.participant)
  const state = readState(context)
  if (state.finalizer?.participant !== participant) {
    throw new Error(`${participant} does not own the finalizer claim`)
  }

  if (state.finalCommit) {
    if (args.push) pushMain(context)
    return { ...resultFor(context), finalCommit: state.finalCommit }
  }

  const source = requireOption(args.file, "--file")
  const contents = readFileSync(resolve(source), "utf8")
  validateFinalPlan(contents)
  const target = `${context.planDirectory}/plan.md`
  if (git(context.repository, "ls-tree", "-r", "--name-only", "main", "--", target)) {
    throw new Error(`${target} already exists on main`)
  }

  const mainWorktree = listWorktrees(context.repository).find(
    worktree => worktree.branch === "main",
  )
  if (!mainWorktree) throw new Error("main must be checked out in a worktree")
  if (git(mainWorktree.path, "status", "--porcelain=v1", "--untracked-files=all")) {
    throw new Error(`Main worktree is not clean: ${mainWorktree.path}`)
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), "converge-plans-finalize-"))
  const temporaryWorktree = join(temporaryRoot, "worktree")
  let finalCommit: string
  try {
    git(context.repository, "worktree", "add", "--detach", temporaryWorktree, "main")
    const destination = join(temporaryWorktree, target)
    mkdirSync(dirname(destination), { recursive: true })
    writeAtomically(destination, contents)
    git(temporaryWorktree, "add", "--", target)
    const staged = lines(git(temporaryWorktree, "diff", "--cached", "--name-only"))
    if (staged.length !== 1 || staged[0] !== target) {
      throw new Error("Finalization must stage only plan.md")
    }
    git(temporaryWorktree, "commit", "-m", `Add plan ${context.run}`)
    finalCommit = git(temporaryWorktree, "rev-parse", "HEAD")
    git(mainWorktree.path, "merge", "--ff-only", finalCommit)
  } finally {
    try {
      git(context.repository, "worktree", "remove", "--force", temporaryWorktree)
    } finally {
      rmSync(temporaryRoot, { force: true, recursive: true })
    }
  }

  const timestamp = new Date().toISOString()
  state.finalCommit = finalCommit
  state.updatedAt = timestamp
  state.participants[participant] = { status: "complete", updatedAt: timestamp }
  writeState(context, state)
  checkpoint(context, `converge-plans: record final plan ${finalCommit.slice(0, 12)}`)
  if (args.push) pushMain(context)
  checkWorkspace(context)
  return { ...resultFor(context), finalCommit }
}

/** Require complementary converged responses against one exact draft pair. */
function assertConvergedEvidence(state: ProtocolState) {
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    const claude = state.artifacts[artifactPath(state, "claude", "response", sequence)]
    const codex = state.artifacts[artifactPath(state, "codex", "response", sequence)]
    if (claude?.verdict === "converged" && codex?.verdict === "converged") return
  }
  throw new Error("Both participants need converged responses against the same draft round")
}

/** Require completed round-five responses and both final candidate drafts. */
function assertRoundLimitEvidence(state: ProtocolState) {
  const claudeResponse = state.artifacts[artifactPath(state, "claude", "response", 5)]
  const codexResponse = state.artifacts[artifactPath(state, "codex", "response", 5)]
  const claudeDraft = state.artifacts[artifactPath(state, "claude", "draft", 6)]
  const codexDraft = state.artifacts[artifactPath(state, "codex", "draft", 6)]
  if (
    !claudeResponse ||
    !codexResponse ||
    !claudeDraft ||
    !codexDraft ||
    (claudeResponse.verdict === "converged" && codexResponse.verdict === "converged")
  ) {
    throw new Error(
      "Round-limit status requires both round-005 responses and both draft-006 candidates",
    )
  }
}

/** Validate that the export is a plain planning document, not a protocol artifact. */
function validateFinalPlan(contents: string) {
  if (contents.includes("converge-plans:")) {
    throw new Error("Final plan must not contain convergence metadata")
  }
  if (/^(<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(contents)) {
    throw new Error("Final plan contains a conflict marker")
  }
  const headings = contents.split("\n").filter(line => /^#{1,2} /.test(line))
  const required = ["## Goal", "## Approach", "## Tasks"]
  if (!headings[0]?.startsWith("# ")) throw new Error("Final plan needs a level-one title")
  let prior = 0
  for (const heading of required) {
    const index = headings.indexOf(heading)
    if (index <= prior) throw new Error(`Final plan must contain ${heading} in plan order`)
    prior = index
  }
}

/** Push the finalized main branch after local state is durable. */
function pushMain(context: Context) {
  const mainWorktree = listWorktrees(context.repository).find(
    worktree => worktree.branch === "main",
  )
  if (!mainWorktree) throw new Error("main must be checked out in a worktree")
  git(mainWorktree.path, "push", "origin", "main")
}

/** Create or resume the shared plan branch and worktree. */
function initialize(args: ParsedArguments, cwd: string) {
  const repository = git(cwd, "rev-parse", "--show-toplevel")
  const run = validatePlanDirectory(args.planDirectory)
  const branch = branchFor(run)
  const worktrees = listWorktrees(repository)
  const existing = worktrees.find(worktree => worktree.branch === branch)
  const main = worktrees.find(worktree => worktree.branch === "main")
  if (!main) throw new Error("The repository must have main checked out in a worktree")

  const worktree =
    existing?.path ?? join(dirname(main.path), `.${basename(main.path)}-worktrees`, branch)
  const commonGitDirectory = resolve(repository, git(repository, "rev-parse", "--git-common-dir"))
  const provisional: Context = {
    branch,
    commonGitDirectory,
    invocationRoot: repository,
    planDirectory: args.planDirectory,
    repository,
    run,
    statePath: join(worktree, args.planDirectory, "convergence/.protocol/state.json"),
    worktree,
  }

  return withLock(provisional, () => {
    const lockedExisting = listWorktrees(repository).find(item => item.branch === branch)
    if (!lockedExisting) {
      mkdirSync(dirname(worktree), { recursive: true })
      if (branchExists(repository, branch)) git(repository, "worktree", "add", worktree, branch)
      else git(repository, "worktree", "add", "-b", branch, worktree, "main")
    }

    const context = loadContext(args.planDirectory, lockedExisting?.path ?? worktree, true)
    const timestamp = new Date().toISOString()
    const state = existsSync(context.statePath)
      ? readState(context)
      : createState(context, git(repository, "rev-parse", "main"), timestamp)

    assertStateMatchesContext(state, context)
    const participant = requireParticipant(args.participant)
    if (
      !state.finalizer &&
      !["converged", "round-limit", "finalizing", "complete"].includes(
        state.participants[participant].status,
      )
    ) {
      state.participants[participant] = { status: "active", updatedAt: timestamp }
    }
    state.updatedAt = timestamp
    writeState(context, state)
    checkpoint(context, `converge-plans: initialize ${run} for ${participant}`)
    checkWorkspace(context)
    return resultFor(context)
  })
}

/** Validate and publish one immutable artifact. */
function publishArtifact(context: Context, args: ParsedArguments) {
  checkWorkspace(context)
  const participant = requireParticipant(args.participant)
  const source = requireOption(args.file, "--file")
  const contents = readFileSync(resolve(source), "utf8")
  const state = readState(context)
  if (state.finalizer) throw new Error("Finalizer selection has closed artifact publication")
  const metadata = validateArtifact(contents, { author: participant, run: context.run })
  assertArtifactOrder(state, metadata)

  const path = `${context.planDirectory}/convergence/${participant}/${metadata.filename}`
  const destination = join(context.worktree, path)
  if (existsSync(destination) || state.artifacts[path]) {
    throw new Error(`${path} already exists; completed artifacts are immutable`)
  }

  mkdirSync(dirname(destination), { recursive: true })
  writeAtomically(destination, contents)
  const timestamp = new Date().toISOString()
  state.artifacts[path] = {
    author: participant,
    kind: metadata.kind,
    path,
    publishedAt: timestamp,
    sequence: metadata.sequence,
    sha256: sha256(contents),
    ...(metadata.verdict ? { verdict: metadata.verdict } : {}),
  }
  state.participants[participant] = { status: "active", updatedAt: timestamp }
  state.updatedAt = timestamp
  writeState(context, state)
  checkpoint(
    context,
    `converge-plans: publish ${participant} ${metadata.kind} ${padSequence(metadata.sequence)}`,
    [path],
  )
  checkWorkspace(context)
  return resultFor(context)
}

/** Verify branch identity, allowed paths, state, and artifact hashes. */
function checkWorkspace(context: Context) {
  if (realpathSync(context.invocationRoot) !== realpathSync(context.worktree)) {
    throw new Error(`Run this command from the shared worktree: ${context.worktree}`)
  }
  const actualRoot = realpathSync(git(context.worktree, "rev-parse", "--show-toplevel"))
  if (actualRoot !== realpathSync(context.worktree)) {
    throw new Error(`Run this command from the shared worktree: ${context.worktree}`)
  }
  const actualBranch = git(context.worktree, "branch", "--show-current")
  if (actualBranch !== context.branch) {
    throw new Error(`Expected branch ${context.branch}; found ${actualBranch || "detached HEAD"}`)
  }

  const state = readState(context)
  assertStateMatchesContext(state, context)
  const committedPaths = lines(
    git(context.worktree, "diff", "--name-only", `${state.baseCommit}..HEAD`),
  )
  const workingPaths = parseStatusPaths(
    git(context.worktree, "status", "--porcelain=v1", "--untracked-files=all"),
  )
  const allowedPaths = new Set([
    relative(context.worktree, context.statePath),
    ...Object.keys(state.artifacts),
  ])
  const forbidden = [...committedPaths, ...workingPaths].find(path => !allowedPaths.has(path))
  if (forbidden) throw new Error(`Write outside the convergence protocol: ${forbidden}`)

  const artifactRoot = join(context.worktree, context.planDirectory, "convergence")
  const diskArtifacts = ["claude", "codex"].flatMap(participant =>
    listFiles(join(artifactRoot, participant)).map(path => relative(context.worktree, path)),
  )
  const unregistered = diskArtifacts.find(path => !state.artifacts[path])
  if (unregistered)
    throw new Error(`Artifact was not published through the helper: ${unregistered}`)

  for (const artifact of Object.values(state.artifacts)) {
    const path = join(context.worktree, artifact.path)
    if (!existsSync(path)) throw new Error(`Published artifact is missing: ${artifact.path}`)
    const contents = readFileSync(path, "utf8")
    if (sha256(contents) !== artifact.sha256) {
      throw new Error(`Artifact changed after publication: ${artifact.path}`)
    }
    validateArtifact(contents, { author: artifact.author, run: state.run })
  }
}

/** Ensure an artifact is the next valid protocol step for its author. */
function assertArtifactOrder(state: ProtocolState, artifact: ParsedArtifact) {
  const peer: Participant = artifact.author === "claude" ? "codex" : "claude"
  const ownDraft = artifactPath(state, artifact.author, "draft", artifact.sequence)
  const peerDraft = artifactPath(state, peer, "draft", artifact.sequence)

  if (artifact.kind === "response") {
    if (artifact.sequence > 5) throw new Error("There is no response round after 005")
    if (!state.artifacts[ownDraft] || !state.artifacts[peerDraft]) {
      throw new Error(
        `Both draft ${padSequence(artifact.sequence)} artifacts must be published first`,
      )
    }
    return
  }

  if (artifact.sequence === 1) return
  const prior = artifact.sequence - 1
  const ownResponse = artifactPath(state, artifact.author, "response", prior)
  const peerResponse = artifactPath(state, peer, "response", prior)
  if (!state.artifacts[ownResponse] || !state.artifacts[peerResponse]) {
    throw new Error(`Both response ${padSequence(prior)} artifacts must be published first`)
  }
  if (
    state.artifacts[ownResponse]?.verdict === "converged" &&
    state.artifacts[peerResponse]?.verdict === "converged"
  ) {
    throw new Error(`Response ${padSequence(prior)} already established mutual convergence`)
  }
}

/** Build an artifact path from protocol metadata. */
function artifactPath(
  state: ProtocolState,
  author: Participant,
  kind: "draft" | "response",
  sequence: number,
) {
  const padded = padSequence(sequence)
  if (kind === "draft") {
    return `${state.planDirectory}/convergence/${author}/draft-${padded}.md`
  }
  const peer = author === "claude" ? "codex" : "claude"
  return `${state.planDirectory}/convergence/${author}/response-${padded}-to-${peer}-draft-${padded}.md`
}

/** Load and validate context for an existing shared plan worktree. */
function loadContext(planDirectory: string, cwd: string, allowMissingState = false): Context {
  const run = validatePlanDirectory(planDirectory)
  const repository = git(cwd, "rev-parse", "--show-toplevel")
  const branch = branchFor(run)
  const worktree = listWorktrees(repository).find(item => item.branch === branch)?.path
  if (!worktree) throw new Error(`No shared worktree exists for ${branch}; run init first`)

  const context: Context = {
    branch,
    commonGitDirectory: resolve(repository, git(repository, "rev-parse", "--git-common-dir")),
    invocationRoot: repository,
    planDirectory,
    repository,
    run,
    statePath: join(worktree, planDirectory, "convergence/.protocol/state.json"),
    worktree,
  }
  if (!allowMissingState && !existsSync(context.statePath)) {
    throw new Error(`Protocol state is missing for ${run}`)
  }
  return context
}

/** Commit only protocol paths while holding the shared lock. */
function checkpoint(context: Context, message: string, artifactPaths: string[] = []) {
  const exactPaths = [relative(context.worktree, context.statePath), ...artifactPaths]
  git(context.worktree, "add", "--", ...exactPaths)
  const staged = lines(git(context.worktree, "diff", "--cached", "--name-only"))
  const permitted = new Set(exactPaths)
  const forbidden = staged.find(path => !permitted.has(path))
  if (forbidden) throw new Error(`Refusing to commit path outside the protocol: ${forbidden}`)
  if (staged.length > 0) git(context.worktree, "commit", "-m", message)
}

/** Serialize state-changing operations across both participants. */
function withLock<T>(context: Context, operation: () => T): T {
  const lockRoot = join(context.commonGitDirectory, "converge-plans")
  const lockPath = join(lockRoot, `${context.branch}.lock`)
  mkdirSync(lockRoot, { recursive: true })

  const deadline = Date.now() + LOCK_WAIT_MILLISECONDS
  while (true) {
    try {
      mkdirSync(lockPath)
      break
    } catch (error) {
      if (!isAlreadyExistsError(error) || Date.now() >= deadline) {
        throw new Error(`Could not acquire coordination lock ${lockPath}`)
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MILLISECONDS)
    }
  }

  try {
    return operation()
  } finally {
    rmSync(lockPath, { recursive: true })
  }
}

/** Parse the small command-line surface. */
function parseArguments(args: string[]): ParsedArguments {
  const [command, planDirectory, ...rest] = args
  if (!command || !COMMANDS.has(command)) throw new Error(USAGE)
  if (!planDirectory) throw new Error(USAGE)

  const options: Record<string, string> = {}
  for (let index = 0; index < rest.length; ) {
    const key = rest[index]
    if (key === "--push") {
      options[key] = "true"
      index += 1
      continue
    }
    const value = rest[index + 1]
    if (!key?.startsWith("--") || !value) throw new Error(USAGE)
    options[key] = value
    index += 2
  }

  return {
    command,
    file: options["--file"],
    participant: options["--participant"],
    planDirectory,
    push: options["--push"] === "true",
    reason: options["--reason"],
    status: options["--status"],
  }
}

/** Validate the canonical plans/NNN-name path and return its run name. */
function validatePlanDirectory(planDirectory: string) {
  if (isAbsolute(planDirectory) || planDirectory.includes(`..${sep}`)) {
    throw new Error("Plan directory must be a repository-relative path")
  }
  const match = planDirectory.match(/^plans\/(\d{3})-([a-z0-9]+(?:-[a-z0-9]+)*)$/)
  if (!match) throw new Error("Plan directory must match plans/NNN-name")
  return `${match[1]}-${match[2]}`
}

/** Read protocol state from disk. */
function readState(context: Context): ProtocolState {
  return JSON.parse(readFileSync(context.statePath, "utf8")) as ProtocolState
}

/** Write protocol state through a same-directory atomic rename. */
function writeState(context: Context, state: ProtocolState) {
  mkdirSync(dirname(context.statePath), { recursive: true })
  writeAtomically(context.statePath, `${JSON.stringify(state, null, 2)}\n`)
}

/** Write a file atomically without exposing a partial artifact. */
function writeAtomically(path: string, contents: string) {
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(temporaryPath, contents, { flag: "wx" })
  renameSync(temporaryPath, path)
}

/** Create initial protocol state. */
function createState(context: Context, baseCommit: string, timestamp: string): ProtocolState {
  const notJoined = {
    reason: "Participant has not joined",
    status: "stopped" as const,
    updatedAt: timestamp,
  }
  return {
    artifacts: {},
    baseCommit,
    branch: context.branch,
    createdAt: timestamp,
    participants: { claude: notJoined, codex: notJoined },
    planDirectory: context.planDirectory,
    run: context.run,
    updatedAt: timestamp,
    version: 1,
  }
}

/** Confirm state belongs to this exact run, directory, branch, and base. */
function assertStateMatchesContext(state: ProtocolState, context: Context) {
  if (
    state.version !== 1 ||
    state.run !== context.run ||
    state.planDirectory !== context.planDirectory ||
    state.branch !== context.branch
  ) {
    throw new Error("Protocol state does not match the expected run, directory, or branch")
  }
  if (!/^[0-9a-f]{40,64}$/.test(state.baseCommit))
    throw new Error("Protocol base commit is invalid")
}

/** List worktrees with their checked-out local branches. */
function listWorktrees(repository: string): Worktree[] {
  const records = git(repository, "worktree", "list", "--porcelain").split("\n\n")
  return records.flatMap(record => {
    const path = record.match(/^worktree (.+)$/m)?.[1]
    const branchRef = record.match(/^branch refs\/heads\/(.+)$/m)?.[1]
    return path ? [{ branch: branchRef, path }] : []
  })
}

/** Recursively list files below a directory if it exists. */
function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

/** Parse paths from porcelain status output. */
function parseStatusPaths(output: string) {
  return lines(output).map(line => {
    const path = line.slice(3)
    return path.includes(" -> ") ? (path.split(" -> ").at(-1) ?? path) : path
  })
}

/** Run Git and return stdout without trailing whitespace. */
function git(cwd: string, ...args: string[]) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trimEnd()
  } catch (error) {
    const detail = error as { stderr?: Buffer | string; stdout?: Buffer | string; message: string }
    throw new Error(String(detail.stderr || detail.stdout || detail.message).trim())
  }
}

/** Check whether a local branch exists. */
function branchExists(repository: string, branch: string) {
  try {
    git(repository, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`)
    return true
  } catch {
    return false
  }
}

/** Return a stable SHA-256 digest for immutable artifact tracking. */
function sha256(contents: string) {
  return createHash("sha256").update(contents).digest("hex")
}

/** Return nonempty output lines. */
function lines(value: string) {
  return value ? value.split("\n").filter(Boolean) : []
}

/** Require a valid participant name. */
function requireParticipant(value: string | undefined): Participant {
  if (value !== "claude" && value !== "codex")
    throw new Error("--participant must be claude or codex")
  return value
}

/** Require a named option. */
function requireOption(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required`)
  return value
}

/** Require a valid participant status. */
function requireStatus(value: string | undefined) {
  if (!value || !PARTICIPANT_STATUSES.has(value)) throw new Error("Invalid --status value")
  return value as ProtocolState["participants"][Participant]["status"]
}

/** Check for an EEXIST filesystem error. */
function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST"
}

/** Build the dedicated branch name for a run. */
function branchFor(run: string) {
  return `plan-${run.slice(0, 3)}`
}

/** Return the last path component. */
function basename(path: string) {
  return path.split(sep).at(-1) ?? path
}

/** Pad a protocol sequence to three digits. */
function padSequence(sequence: number) {
  return String(sequence).padStart(3, "0")
}

/** Build a command result for CLI output and tests. */
function resultFor(context: Context): CommandResult {
  return {
    branch: context.branch,
    planDirectory: context.planDirectory,
    worktree: context.worktree,
  }
}

// CONSTANTS

const COMMANDS = new Set(["init", "check", "publish", "status", "claim-finalizer", "finalize"])
const LOCK_RETRY_MILLISECONDS = 50
const LOCK_WAIT_MILLISECONDS = 30_000
const PARTICIPANT_STATUSES = new Set([
  "active",
  "waiting",
  "converged",
  "round-limit",
  "blocked",
  "stopped",
])
const USAGE =
  "Usage: converge-plans <init|check|publish|status|claim-finalizer|finalize> plans/NNN-name [options]"

// TYPES

type CommandResult = {
  branch: string
  finalCommit?: string
  finalizer?: { recovered: boolean; won: boolean }
  planDirectory: string
  state?: ProtocolState
  worktree: string
}

type Context = CommandResult & {
  commonGitDirectory: string
  invocationRoot: string
  repository: string
  run: string
  statePath: string
}

type ParsedArguments = {
  command: string
  planDirectory: string
  participant?: string
  file?: string
  status?: string
  push?: boolean
  reason?: string
}

type Worktree = {
  branch?: string
  path: string
}
