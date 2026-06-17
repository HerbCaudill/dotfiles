/** A transcript artifact that should be copied into the archive repository. */
export type TranscriptEntry = {
  /** The source path on the local machine. */
  absoluteSourcePath: string
  /** The destination path inside the archive repository. */
  archiveRelativePath: string
  /** The source path relative to the local home directory. */
  sourceRelativePath: string
}

/** A fixed transcript artifact with a known source path. */
export type FixedTranscriptFile = {
  /** The destination path inside the archive repository. */
  archiveRelativePath: string
  /** The source path relative to the local home directory. */
  sourceRelativePath: string
}
