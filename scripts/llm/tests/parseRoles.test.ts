import { readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "vitest"
import { parseRoles } from "../parseRoles.ts"

const markdown = `# Instructions

## Model roles

Some prose.

| Role      | Harness     | Model             | Effort | Use for          |
| --------- | ----------- | ----------------- | ------ | ---------------- |
| \`default\` | Claude Code | \`claude-opus-5-5\` | high   | Anything else    |
| \`bulk\`    | Codex       | \`gpt-6.1-terra\`   | low    | Simple, high volume |

## Workflow

| Role | Harness | Model | Effort |
| ---- | ------- | ----- | ------ |
| \`other\` | Codex | \`gpt-x\` | low |
`

test("reads each role's harness, model and effort from the model roles table", () => {
  expect(parseRoles(markdown)).toEqual([
    { effort: "high", harness: "claude", model: "claude-opus-5-5", name: "default" },
    { effort: "low", harness: "codex", model: "gpt-6.1-terra", name: "bulk" },
  ])
})

test("rejects a harness that llm can't run", () => {
  expect(() => parseRoles(markdown.replace("Claude Code", "Gemini CLI"))).toThrow(/Gemini CLI/)
})

test("rejects an unknown effort", () => {
  expect(() => parseRoles(markdown.replace("high  ", "turbo "))).toThrow(/turbo/)
})

test("fails when the section is missing", () => {
  expect(() => parseRoles("# Nothing here")).toThrow(/Model roles/)
})

test("reads the real global instructions", () => {
  const source = readFileSync(join(import.meta.dirname, "../../../home/.claude/AGENTS.md"), "utf8")
  expect(parseRoles(source).map(role => role.name)).toContain("default")
})
