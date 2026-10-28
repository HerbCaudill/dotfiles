import { getProcessIdentity } from "./getProcessIdentity.ts"

/** Match a live process against its recorded start identity, without signalling it. */
export function isRunning(
  /** PID saved by the service itself. */
  pid: number,
  /** Start time and command captured when the daemon acquired its receipt. */
  identity: string,
) {
  return Boolean(identity && getProcessIdentity(pid) === identity)
}
