import { spawnSync } from "node:child_process"
import { expect, test } from "vitest"

import { withMetadataBranchGuard } from "../withMetadataBranchGuard.ts"

test("a project with no ignore command skips only metadata branches", () => {
  const command = withMetadataBranchGuard(null)!
  expect(outcome(command, "__dolt_remote_info__")).toBe("skip")
  expect(outcome(command, "beads-sync")).toBe("skip")
  expect(outcome(command, "main")).toBe("build")
  expect(outcome(command, "feature/beads-ui")).toBe("build")
  expect(outcome(command, undefined)).toBe("build")
})

test("an existing ignore command still decides for other branches", () => {
  const command = withMetadataBranchGuard('[ "$VERCEL_GIT_COMMIT_REF" = "docs" ]')!
  expect(outcome(command, "__dolt_remote_info__")).toBe("skip")
  expect(outcome(command, "beads-sync")).toBe("skip")
  expect(outcome(command, "docs")).toBe("skip")
  expect(outcome(command, "main")).toBe("build")
})

test("an already guarded command is left alone", () => {
  const guarded = withMetadataBranchGuard(null)!
  expect(withMetadataBranchGuard(guarded)).toBeUndefined()
})

/** Run an Ignored Build Step command the way Vercel does: exit 0 skips the build. */
const outcome = (
  /** The shell command. */
  command: string,
  /** The branch being deployed, if any. */
  ref: string | undefined,
) => {
  const env = { ...process.env }
  delete env.VERCEL_GIT_COMMIT_REF
  if (ref !== undefined) env.VERCEL_GIT_COMMIT_REF = ref
  const { status } = spawnSync("sh", ["-c", command], { env })
  return status === 0 ? "skip" : "build"
}
