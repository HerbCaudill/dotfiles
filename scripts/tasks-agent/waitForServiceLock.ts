import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { setTimeout } from "node:timers/promises"

/** Wait for the existing service's exact ownership lock after launchd has stopped it. */
export async function waitForServiceLock(
  /** Candidate release and state location; ECHO files are never opened by this tool. */
  options: {
    /** Prepared Tasks source release containing the reviewed ownership helper. */
    release: string
    /** Private service parent with the process lock and separate peer/ child. */
    stateDir: string
    /** Bounded graceful exit deadline. */
    timeoutMs?: number
    /** Ownership boundary used by isolated tests. */
    acquire?: () => Promise<{ close: () => void }>
  },
) {
  const acquire =
    options.acquire ??
    (async () => {
      const { acquireServiceLock } = await import(
        pathToFileURL(join(options.release, "src/agent/service/acquireServiceLock.ts")).href
      )
      return acquireServiceLock(options.stateDir) as Promise<{ close: () => void }>
    })
  const deadline = Date.now() + (options.timeoutMs ?? 75_000)
  while (true) {
    try {
      return await acquire()
    } catch {
      if (Date.now() >= deadline)
        throw new Error("The service has not released its storage; release selection is unchanged.")
      await setTimeout(Math.min(50, deadline - Date.now()))
    }
  }
}
