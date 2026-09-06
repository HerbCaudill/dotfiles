import { expect, test } from "vitest"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { loadPrState } from "../loadPrState.ts"
import { savePrState } from "../savePrState.ts"
import { createPrIntent } from "../createPrIntent.ts"

test("retains legacy checkpoints and replaces state durably with private permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-state-"))
  const path = join(root, "state.json")
  try {
    const legacy = {
      lastCheckedAt: "2026-09-06T09:00:00Z",
      processedEventKeys: ["legacy"],
      custom: { original: true },
    }
    await writeFile(path, JSON.stringify(legacy))
    const state = await loadPrState(path)
    expect(state).toEqual({ ...legacy, intents: {} })
    const intent = createPrIntent("event", {
      title: "PR: Original",
      notes: "https://github.com/example/repo/pull/1",
    })
    const next = { ...state, intents: { event: intent } }
    await expect(
      savePrState(next, path, async () => {
        throw new Error("Replace interrupted")
      }),
    ).rejects.toThrow("Replace interrupted")
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(legacy)
    await savePrState(next, path)
    expect(await loadPrState(path)).toEqual(next)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    await writeFile(path, "{broken")
    await expect(loadPrState(path)).rejects.toThrow()
    await writeFile(path, JSON.stringify({ ...legacy, processedEventKeys: [42] }))
    await expect(loadPrState(path)).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
