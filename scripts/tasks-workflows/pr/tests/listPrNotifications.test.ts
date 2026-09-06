import { expect, test, vi } from "vitest"
import { listPrNotifications } from "../listPrNotifications.ts"

test("collects every GitHub page and rejects malformed responses instead of returning empty success", async () => {
  const record = {
    id: "1",
    reason: "assign",
    updated_at: "2026-09-06T12:00:00Z",
    subject: {
      title: "Change",
      type: "PullRequest",
      url: "https://api.github.com/repos/example/repo/pulls/1",
    },
  }
  const run = vi.fn().mockResolvedValue(JSON.stringify([[record], [{ ...record, id: "2" }]]))
  expect(await listPrNotifications("2026-09-06T11:00:00Z", run)).toHaveLength(2)
  expect(run).toHaveBeenCalledWith(
    expect.arrayContaining(["--paginate", "--slurp", "since=2026-09-06T11:00:00Z"]),
  )
  for (const payload of [{ error: "unavailable" }, [], [[{ ...record, id: 42 }]]]) {
    run.mockResolvedValue(JSON.stringify(payload))
    await expect(listPrNotifications(null, run)).rejects.toThrow()
  }
})
