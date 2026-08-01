#!/usr/bin/env node

import { listSessions } from "./list-sessions.ts"
import { parseArguments } from "./parse-arguments.ts"
import { readSession } from "./read-session.ts"
import { renderSessionList } from "./render-session-list.ts"
import { renderTranscript } from "./render-transcript.ts"
import { searchSessions } from "./search-sessions.ts"
import { usage } from "./usage.ts"

try {
  const options = parseArguments(process.argv.slice(2))

  if (options.command === "help") {
    console.log(usage)
  } else if (options.command === "list") {
    console.log(
      renderSessionList(listSessions(options.source, options.cwd, options.limit, options.archived)),
    )
  } else if (options.command === "search") {
    console.log(
      renderSessionList(
        searchSessions(
          options.value!,
          options.source,
          options.cwd,
          options.limit,
          options.archived,
        ),
      ),
    )
  } else {
    console.log(renderTranscript(readSession(options.value!, options.source, options.tools)))
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error("")
  console.error(usage)
  process.exitCode = 1
}
