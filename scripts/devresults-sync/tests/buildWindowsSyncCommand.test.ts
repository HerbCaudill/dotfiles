import { describe, expect, test } from "vitest"

import { buildWindowsSyncCommand } from "../buildWindowsSyncCommand.ts"

describe("buildWindowsSyncCommand", () => {
  test("refuses to sync over a dirty Windows checkout", () => {
    const command = buildWindowsSyncCommand("herb/wip/some-feature", ["pnpm", "test"])

    expect(command).toContain("Windows checkout has uncommitted changes")
    expect(command).toContain("[Console]::Out.WriteLine")
    expect(command).not.toContain("Write-Error")
  })

  test("fetches and fast-forwards the matching WIP branch before running a command", () => {
    const command = buildWindowsSyncCommand("herb/wip/some-feature", ["pnpm", "test"])

    expect(command).toContain("& 'git' 'fetch' 'origin'")
    expect(command).toContain(
      "refs/heads/herb/wip/some-feature:refs/remotes/origin/herb/wip/some-feature",
    )
    expect(command).toContain("git switch 'herb/wip/some-feature'")
    expect(command).toContain("& 'git' 'merge' '--ff-only' 'origin/herb/wip/some-feature'")
    expect(command).toContain("& 'pnpm' 'test'")
  })
})
