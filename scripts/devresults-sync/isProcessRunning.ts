/** Check whether a local process is running. */
export function isProcessRunning(
  /** The process ID */
  pid: number,
) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
