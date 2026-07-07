/** Parsed drsync execution mode. */
export type DrsyncMode = "background" | "foreground" | "worker"

/** Parsed drsync command-line arguments. */
export type DrsyncArgs = {
  /** The command arguments to run after syncing */
  args: string[]
  /** The drsync execution mode */
  mode: DrsyncMode
}
