import { expect, test } from "vitest"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { createTasksCall } from "../createTasksCall.ts"
import { runTasksCommand } from "../runTasksCommand.ts"
import { syncPrTasks } from "../syncPrTasks.ts"
import { loadPrState } from "../loadPrState.ts"
import { savePrState } from "../savePrState.ts"
import { completePrEvent } from "../completePrEvent.ts"

test("recovers actual CLI process reply loss without duplicating tasks or undoing later human edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "pr-cli-"))
  const service = join(root, "fixture-service.json")
  const checkpoint = join(root, "checkpoint.json")
  const fixture = fileURLToPath(new URL("./fixtures/tasksCli.ts", import.meta.url))
  try {
    await writeFile(
      service,
      JSON.stringify({ tasks: [], receipts: {}, loseCapture: true, loseDescription: true }),
      { mode: 0o600 },
    )
    const call = createTasksCall(
      { spaceId: "fixture-space", freshness: "converged" },
      (args, input) => runTasksCommand([fixture, service, ...args], input, process.execPath),
    )
    const event = {
      id: "event",
      reason: "assign",
      updated_at: "2026-09-06T11:00:00Z",
      subject: {
        title: "Original 🧭",
        type: "PullRequest",
        url: "https://api.github.com/repos/example/repo/pulls/1",
      },
    }
    const dependencies = {
      now: () => "2026-09-06T12:00:00Z",
      loadState: () => loadPrState(checkpoint),
      saveState: state => savePrState(state, checkpoint),
      listNotifications: async () => [event],
      completeEvent: (intent, save) => completePrEvent(intent, call, save),
    } satisfies Parameters<typeof syncPrTasks>[0]
    await expect(syncPrTasks(dependencies)).rejects.toThrow()
    expect((await loadPrState(checkpoint)).lastCheckedAt).toBeNull()
    let state = JSON.parse(await readFile(service, "utf8"))
    state.tasks[0].title = "Human rename"
    state.tasks[0].completedAt = "2026-09-06T11:30:00Z"
    await writeFile(service, JSON.stringify(state))
    event.subject.title = "Later notification wording"
    await expect(syncPrTasks(dependencies)).rejects.toThrow()
    state = JSON.parse(await readFile(service, "utf8"))
    state.tasks[0].description = "Human notes after the original URL saved"
    await writeFile(service, JSON.stringify(state))
    await syncPrTasks(dependencies)
    await syncPrTasks(dependencies)
    state = JSON.parse(await readFile(service, "utf8"))
    expect(state.tasks).toEqual([
      {
        id: "task-1",
        title: "Human rename",
        completedAt: "2026-09-06T11:30:00Z",
        description: "Human notes after the original URL saved",
      },
    ])
    expect(Object.keys(state.receipts)).toHaveLength(2)
    const persisted = await loadPrState(checkpoint)
    expect(persisted.processedEventKeys).toEqual(["event:2026-09-06T11:00:00Z"])
    expect(persisted.lastCheckedAt).toBe("2026-09-06T12:00:00Z")
    expect(persisted.intents[persisted.processedEventKeys[0]]).toMatchObject({
      phase: "saved",
      taskId: "task-1",
      title: "PR: Original 🧭",
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
