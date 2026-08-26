/** Gmail account authorized for supervised email processing. */
export const EMAIL_PROCESSING_ACCOUNT = "herb@devresults.com" as const

/** Maximum Gmail-changing decisions accepted in one classifier batch. */
export const MAX_ACTIONS_PER_RUN = 10

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
