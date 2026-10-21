import { expect, test, vi } from "vitest"
import { spawnSync } from "node:child_process"
import { spawnDelegatedGws } from "../spawnDelegatedGws.ts"

vi.mock("node:child_process", () => ({ spawnSync: vi.fn(() => ({ status: 7 })) }))

test("passes arguments literally and the token only through the environment", () => {
  expect(
    spawnDelegatedGws(
      ["drive", "files", "list", "--params", '{"q":"name = \'a&b\'"}'],
      "short-lived-token",
    ),
  ).toBe(7)
  expect(spawnSync).toHaveBeenCalledWith(
    process.platform === "win32" ? expect.stringMatching(/gws\.exe$/) : "gws",
    ["drive", "files", "list", "--params", '{"q":"name = \'a&b\'"}'],
    expect.objectContaining({
      env: expect.objectContaining({ GOOGLE_WORKSPACE_CLI_TOKEN: "short-lived-token" }),
      shell: false,
    }),
  )
})
