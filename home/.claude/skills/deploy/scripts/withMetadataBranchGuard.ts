/**
 * Add the Beads/Dolt metadata-branch check to a Vercel Ignored Build Step command. Returns
 * undefined when the command already has it. Vercel skips the build when the command exits 0.
 */
export const withMetadataBranchGuard = (
  /** The project's current `commandForIgnoringBuildStep`, if any. */
  existing: string | null | undefined,
): string | undefined => {
  const current = existing?.trim()
  if (!current) return `${SKIP_METADATA_BRANCHES} *) exit 1 ;; esac`
  if (current.includes(METADATA_BRANCHES[0])) return undefined
  // Let the existing command keep deciding for every other branch.
  return `${SKIP_METADATA_BRANCHES} esac; ${current}`
}

/** Branches that Beads and Dolt push to sync metadata; they contain no app to build. */
const METADATA_BRANCHES = ["__dolt_remote_info__", "beads-sync"]

/** The opening of the case statement that skips metadata branches. */
const SKIP_METADATA_BRANCHES = `case "$VERCEL_GIT_COMMIT_REF" in ${METADATA_BRANCHES.join("|")}) exit 0 ;;`
