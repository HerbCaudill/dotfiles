import { describe, expect, test } from "vitest"

import { buildWindowsCleanCheckCommand } from "../buildWindowsCleanCheckCommand.ts"

describe("buildWindowsCleanCheckCommand", () => {
  test("reports dirty Windows status as plain output", () => {
    const command = buildWindowsCleanCheckCommand()

    expect(command).toContain("git status --porcelain")
    expect(command).toContain("[Console]::Out.WriteLine")
    expect(command).toContain("Windows checkout has uncommitted changes")
    expect(command).not.toContain("Write-Error")
  })
})
