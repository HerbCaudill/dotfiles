/** Gmail account authorized for supervised email processing. */
export const EMAIL_PROCESSING_ACCOUNT = "herb@devresults.com" as const

/**
 * Maximum messages inspected, and so Gmail changes made, in one run. The policy archives by
 * default, so nearly every message is an action; anything beyond the cap waits for the next run.
 */
export const MAX_ACTIONS_PER_RUN = 50

/** Gmail label Herb or his filters put on mail the job must leave alone. */
export const KEEP_LABEL_NAME = "Keep"

/** Archives of one sender, with no reversal, before the job proposes a Gmail filter for it. */
export const FILTER_PROPOSAL_MIN_ARCHIVES = 3

/** Window in days over which archives count toward a filter proposal. */
export const FILTER_PROPOSAL_WINDOW_DAYS = 30

/** Gmail categories from which a message may be promoted to Primary. */
export const PROMOTABLE_CATEGORIES = ["updates", "promotions", "social", "forums"] as const

/** Exact thread-level label delta authorized for archive decisions. */
export const ARCHIVE_LABEL_MUTATION = {
  addLabelIds: [],
  removeLabelIds: ["INBOX"],
} as const

/** Exact thread-level label delta authorized for promotion decisions. */
export const PROMOTE_LABEL_MUTATION = {
  addLabelIds: ["CATEGORY_PERSONAL"],
  removeLabelIds: ["CATEGORY_UPDATES", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"],
} as const
