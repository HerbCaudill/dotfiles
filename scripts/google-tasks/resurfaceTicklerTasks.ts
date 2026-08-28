#!/usr/bin/env -S node --experimental-strip-types

import { spawnSync } from "node:child_process"

import { isMainModule } from "../isMainModule.ts"

const GWS_COMMAND = "gws-delegated"

/** Move due Tickler task trees into Today and clear their resurface dates. */
export function runResurfaceTicklerTasks(
  /** Command-line arguments, including an optional `--dry-run`. */
  args: readonly string[] = process.argv.slice(2),
): void {
  const dryRun = args.includes("--dry-run")
  const tickler = findTaskList("Tickler")
  const today = findTaskList("Today")
  const ticklerTasks = listTasks(tickler.id)
  const roots = findDueRoots(ticklerTasks, getMadridDate())

  if (roots.length === 0) {
    console.log("No overdue Tickler tasks.")
    return
  }

  if (dryRun) {
    console.log(`Would move: ${roots.map(task => task.title).join("; ")}`)
    return
  }

  for (const root of roots) {
    runGws("tasks", "move", {
      destinationTasklist: today.id,
      task: root.id,
      tasklist: tickler.id,
    })
    runGws(
      "tasks",
      "update",
      { task: root.id, tasklist: today.id },
      {
        id: root.id,
        notes: root.notes,
        status: root.status,
        title: root.title,
      },
    )

    verifyMovedSubtree(ticklerTasks, listTasks(today.id), root)
  }

  console.log(`Moved: ${roots.map(task => task.title).join("; ")}`)
}

/** Select incomplete root tasks whose resurface date is today or earlier. */
export function findDueRoots(
  /** Tasks currently in the Tickler list. */
  tasks: readonly Task[],
  /** Current Europe/Madrid date in YYYY-MM-DD form. */
  today: string,
): Task[] {
  return tasks.filter(
    task =>
      task.status === "needsAction" &&
      !task.parent &&
      task.due !== undefined &&
      task.due.slice(0, 10) <= today,
  )
}

/** Verify that a moved root and every descendant arrived intact in Today. */
export function verifyMovedSubtree(
  /** Snapshot of the source list before the move. */
  sourceTasks: readonly Task[],
  /** Snapshot of the Today list after the move. */
  todayTasks: readonly Task[],
  /** Root task that was moved. */
  root: Task,
): void {
  const moved = new Map(todayTasks.map(task => [task.id, task]))
  const todayRoot = moved.get(root.id)
  if (!todayRoot) throw new Error(`Moved task missing from Today: ${root.title}`)
  if (todayRoot.due) throw new Error(`Moved task still has a due date: ${root.title}`)

  for (const task of getDescendants(sourceTasks, root.id)) {
    const movedTask = moved.get(task.id)
    if (!movedTask) throw new Error(`Moved descendant missing from Today: ${task.title}`)
    if (
      movedTask.parent !== task.parent ||
      movedTask.title !== task.title ||
      movedTask.notes !== task.notes ||
      movedTask.status !== task.status
    ) {
      throw new Error(`Moved descendant changed unexpectedly: ${task.title}`)
    }
  }
}

/** Return today's calendar date in Europe/Madrid. */
function getMadridDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Madrid",
    year: "numeric",
  }).formatToParts()

  /** Find one component of the formatted date. */
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`
}

/** Find a Google Tasks list by its exact title. */
function findTaskList(
  /** Exact Google Tasks list title. */
  title: string,
): TaskList {
  const response = runGws<{ items?: TaskList[] }>("tasklists", "list", {
    maxResults: 1000,
  })
  const list = response.items?.find(item => item.title === title)
  if (!list) throw new Error(`Google Tasks list not found: ${title}`)
  return list
}

/** List every task in a Google Tasks list, following pagination. */
function listTasks(
  /** Google Tasks list identifier. */
  tasklist: string,
): Task[] {
  const tasks: Task[] = []
  let pageToken: string | undefined

  do {
    const page = runGws<TaskPage>("tasks", "list", {
      maxResults: 100,
      pageToken,
      showCompleted: true,
      showHidden: true,
      tasklist,
    })
    tasks.push(...(page.items ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)

  return tasks
}

/** Return every descendant of a task in parent-before-child order. */
function getDescendants(
  /** Tasks in the source list. */
  tasks: readonly Task[],
  /** Parent task identifier. */
  parentId: string,
): Task[] {
  const children = tasks.filter(task => task.parent === parentId)
  return children.flatMap(child => [child, ...getDescendants(tasks, child.id)])
}

/** Run one delegated Google Workspace CLI request and parse its JSON response. */
function runGws<T>(
  /** Google Workspace resource. */
  resource: string,
  /** Resource method. */
  method: string,
  /** Query parameters passed to the CLI. */
  params?: Record<string, unknown>,
  /** Optional JSON request body. */
  body?: unknown,
): T {
  const args = ["tasks", resource, method]
  if (params) args.push("--params", JSON.stringify(params))
  if (body) args.push("--json", JSON.stringify(body))

  const result = spawnSync(GWS_COMMAND, args, { encoding: "utf8" })
  const output = result.stdout.trim()
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || output || `${GWS_COMMAND} ${resource} ${method} failed`)
  }

  return JSON.parse(output) as T
}

/** One Google Tasks task used by the resurface workflow. */
export type Task = {
  /** Stable task identifier. */
  id: string
  /** User-visible task title. */
  title: string
  /** Current completion status. */
  status: TaskStatus
  /** Optional due date, used here as a resurface date. */
  due?: string
  /** Optional task notes. */
  notes?: string
  /** Parent task identifier for nested tasks. */
  parent?: string
}

/** Completion states returned by Google Tasks. */
type TaskStatus = "needsAction" | "completed"

/** Google Tasks list metadata. */
type TaskList = {
  /** Stable list identifier. */
  id: string
  /** User-visible list title. */
  title: string
}

/** One page returned by the Google Tasks list endpoint. */
type TaskPage = {
  /** Tasks on this page. */
  items?: Task[]
  /** Token for the next page, when one exists. */
  nextPageToken?: string
}

if (isMainModule(import.meta.url)) {
  try {
    runResurfaceTicklerTasks()
  } catch (error) {
    console.error(
      `[resurface-tickler-tasks] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
}
