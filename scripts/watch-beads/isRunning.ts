/** Check a process receipt without signalling or terminating the process. */
export function isRunning(
  /** PID saved by the service itself. */
  pid: number,
) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
