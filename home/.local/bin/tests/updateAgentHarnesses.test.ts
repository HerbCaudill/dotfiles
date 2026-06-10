import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

describe("update-agent-harnesses", () => {
  test("uses macOS-compatible timestamps", () => {
    const script = readFileSync(
      join(process.cwd(), "home/.local/bin/update-agent-harnesses"),
      "utf8",
    )

    expect(script).not.toContain("date -Is")
    expect(script).toContain("date +%Y-%m-%dT%H:%M:%S%z")
  })

  test("updates pnpm without editing shell startup files", () => {
    const script = readFileSync(
      join(process.cwd(), "home/.local/bin/update-agent-harnesses"),
      "utf8",
    )

    expect(script).not.toContain("https://get.pnpm.io/install.sh")
    expect(script).toContain("pnpm self-update")
  })

  test("asks pnpm for the latest agent packages", () => {
    const script = readFileSync(
      join(process.cwd(), "home/.local/bin/update-agent-harnesses"),
      "utf8",
    )

    expect(script).toContain("pnpm add -g @openai/codex@latest")
    expect(script).toContain("pnpm add -g @earendil-works/pi-coding-agent@latest")
  })

  test("clears stale lock directories in user-owned state", () => {
    const script = readFileSync(
      join(process.cwd(), "home/.local/bin/update-agent-harnesses"),
      "utf8",
    )

    expect(script).toContain('state_dir="$HOME/.local/state"')
    expect(script).toContain('pid_file="$lock_dir/pid"')
    expect(script).toContain('rm -rf "$lock_dir"')
  })

  test("runs outside project directories with pnpm global bin paths available", () => {
    const script = readFileSync(
      join(process.cwd(), "home/.local/bin/update-agent-harnesses"),
      "utf8",
    )

    expect(script).toContain("$PNPM_HOME/bin")
    expect(script).toContain(":$PATH")
    expect(script).toContain('cd "$HOME"')
  })

  test("repairs stale pnpm installer global dependency", () => {
    const script = readFileSync(
      join(process.cwd(), "home/.local/bin/update-agent-harnesses"),
      "utf8",
    )

    expect(script).toContain("removeStalePnpmExeDependency")
    expect(script).toContain("@pnpm/exe")
  })
})
