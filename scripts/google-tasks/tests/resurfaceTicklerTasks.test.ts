import { describe, expect, test } from "vitest"

import { findDueRoots, verifyMovedSubtree, type Task } from "../resurfaceTicklerTasks.ts"

const tasks: Task[] = [
  {
    id: "later",
    due: "2026-08-29T00:00:00.000Z",
    status: "needsAction",
    title: "Later",
  },
  {
    id: "done",
    due: "2026-08-27T00:00:00.000Z",
    status: "completed",
    title: "Done",
  },
  {
    id: "root",
    due: "2026-08-28T00:00:00.000Z",
    status: "needsAction",
    title: "Root",
  },
  { id: "child", parent: "root", status: "needsAction", title: "Child" },
  {
    id: "grandchild",
    parent: "child",
    status: "completed",
    title: "Grandchild",
  },
]

describe("findDueRoots", () => {
  test("selects incomplete top-level tasks due today or earlier", () => {
    expect(findDueRoots(tasks, "2026-08-28")).toEqual([tasks[2]])
  })
})

describe("verifyMovedSubtree", () => {
  test("accepts a complete hierarchy in Today with the due date cleared", () => {
    expect(() =>
      verifyMovedSubtree(tasks, [{ ...tasks[2], due: undefined }, tasks[3], tasks[4]], tasks[2]),
    ).not.toThrow()
  })

  test("rejects a missing descendant", () => {
    expect(() =>
      verifyMovedSubtree(tasks, [{ ...tasks[2], due: undefined }, tasks[3]], tasks[2]),
    ).toThrow("Grandchild")
  })
})
