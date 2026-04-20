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

/** The input for inserting or updating a managed text block. */
export type ManagedBlock = {
  /** The body content that should appear between the managed markers. */
  blockBody: string
  /** The full existing file contents. */
  existingContents: string
  /** The logical block name used in begin and end markers. */
  name: string
}
