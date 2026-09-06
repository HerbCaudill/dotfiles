import { expect, test, vi } from "vitest"
import { createTasksCall } from "../createTasksCall.ts"

const metadata = {
  spaceId: "reviewed-space",
  timezone: "Europe/Madrid",
  observedAt: "2026-09-06T12:00:00Z",
}

test("passes explicit binding and freshness through the CLI without downgrading unavailable responses", async () => {
  const run = vi
    .fn()
    .mockResolvedValue({ code: 4, stdout: JSON.stringify({ status: "unavailable" }) })
  const call = createTasksCall({ spaceId: "reviewed-space", freshness: "converged" }, run)
  expect(await call("capture", { title: "PR: 🧭", eventKey: "event" }, "receipt")).toEqual({
    status: "unavailable",
  })
  expect(run).toHaveBeenCalledWith(
    expect.arrayContaining([
      "capture",
      "--freshness",
      "converged",
      "--timezone",
      "Europe/Madrid",
      "--request-id",
      "receipt",
      "--input",
      "-",
    ]),
    '{"title":"PR: 🧭","eventKey":"event"}\n',
  )
  expect(run).toHaveBeenCalledTimes(1)
  run.mockResolvedValue({
    code: 0,
    stdout: JSON.stringify({ status: "ok", metadata: { ...metadata, spaceId: "wrong" } }),
  })
  await expect(call("status", {})).rejects.toThrow("space")
  run.mockResolvedValue({ code: 0, stdout: JSON.stringify({ status: "ok", metadata }) })
  expect(await call("status", {})).toMatchObject({ status: "ok" })
  run.mockResolvedValue({ code: 0, stdout: '{"status":"unavailable"}' })
  await expect(call("status", {})).rejects.toThrow("exit")
  run.mockResolvedValue({ code: 0, stdout: "not JSON" })
  await expect(call("status", {})).rejects.toThrow()
})
