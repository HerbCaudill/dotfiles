#!/usr/bin/env node

import { findSessionsInTimeWindow } from "./find-sessions-in-time-window.ts"
import { listSessions } from "./list-sessions.ts"
import { parseArguments } from "./parse-arguments.ts"
import { readSession } from "./read-session.ts"
import { renderActivity, renderActivityJson } from "./render-activity.ts"
import { renderJson } from "./render-json.ts"
import { renderSessionList } from "./render-session-list.ts"
import { renderTranscript } from "./render-transcript.ts"
import { searchSessions } from "./search-sessions.ts"
import { usage } from "./usage.ts"

try {
  const options = parseArguments(process.argv.slice(2))

  if (options.command === "help") {
    console.log(usage)
  } else if (options.command === "list") {
    const sessions = listSessions(
      options.source,
      options.cwd,
      options.limit,
      options.archived,
      options.timeWindow,
    )
    console.log(
      options.format === "json"
        ? renderJson(sessions)
        : renderSessionList(sessions, Boolean(options.timeWindow)),
    )
  } else if (options.command === "search") {
    const sessions = searchSessions(
      options.value!,
      options.source,
      options.cwd,
      options.limit,
      options.archived,
      options.timeWindow,
    )
    console.log(
      options.format === "json"
        ? renderJson(sessions)
        : renderSessionList(sessions, Boolean(options.timeWindow)),
    )
  } else if (options.command === "activity") {
    const sessions = findSessionsInTimeWindow(
      options.source,
      options.cwd,
      options.archived,
      options.tools,
      options.timeWindow!,
    ).slice(0, options.limit)
    console.log(
      options.format === "json"
        ? renderActivityJson(sessions, options.timeWindow!)
        : renderActivity(sessions, options.timeWindow!),
    )
  } else {
    const session = readSession(options.value!, options.source, options.tools, options.timeWindow)
    console.log(
      options.format === "json"
        ? renderJson(session)
        : renderTranscript(session, options.timestamps || Boolean(options.timeWindow)),
    )
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error("")
  console.error(usage)
  process.exitCode = 1
}
