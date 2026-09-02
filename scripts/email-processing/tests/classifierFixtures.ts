/** A valid normalized classifier input with one candidate. */
export const validClassifierInput = {
  evaluatedAt: "2026-08-26T12:00:00.000Z",
  policyVersion: `sha256:${"a".repeat(64)}`,
  account: "herb@devresults.com",
  candidates: [
    {
      messageId: "message-1",
      threadId: "thread-1",
      receivedAt: "2026-08-26T11:00:00.000Z",
      sender: {
        name: "Vendor Person",
        address: "vendor@example.com",
      },
      recipients: [
        {
          name: "Herb Caudill",
          address: "herb@devresults.com",
        },
      ],
      subject: "A proposal",
      body: "Would you like to buy our software?",
      thread: [],
      category: "primary",
      archiveProtections: {
        devResultsSender: false,
        priorReply: false,
        archiveReversal: false,
        protectedCorrespondent: false,
        activeConversation: false,
        requestedWork: false,
        herbInitiated: false,
      },
      delegatedCustomer: {
        customerInquiry: false,
        otherDevResultsRecipient: false,
        requiresHerbAction: false,
      },
      promotionCorrections: [],
    },
  ],
}

/** A valid high-confidence archive decision. */
export const validArchiveOutput = {
  decisions: [
    {
      messageId: "message-1",
      decision: "archive",
      classification: "cold-vendor",
      confidence: "high",
      reason: "This is an unsolicited software sales pitch.",
      policySignals: ["unsolicited-sales"],
    },
  ],
}

/** A valid medium-confidence promotion decision. */
export const validPromoteOutput = {
  decisions: [
    {
      messageId: "message-1",
      decision: "promote",
      classification: "explicit-action",
      confidence: "medium",
      reason: "The message explicitly asks Herb to approve a change.",
      policySignals: ["approval-request"],
    },
  ],
}

/** A valid no-action decision. */
export const validNoneOutput = {
  decisions: [
    {
      messageId: "message-1",
      decision: "none",
      classification: "no-action",
      confidence: "low",
      reason: "The message is an ordinary receipt.",
      policySignals: ["routine-receipt"],
    },
  ],
}

/** Archive-protection fields that veto unwanted-mail decisions. */
export const archiveProtectionFields = [
  "devResultsSender",
  "priorReply",
  "archiveReversal",
  "protectedCorrespondent",
  "activeConversation",
  "requestedWork",
  "herbInitiated",
] as const

/** Gmail categories eligible for promotion to Primary. */
export const promotableCategories = ["updates", "promotions", "social", "forums"] as const

/** Stable archive classifications agreed by policy. */
export const archiveClassifications = [
  "cold-vendor",
  "cold-job-inquiry",
  "cold-investor",
  "generic-solicitation",
  "misfiled-marketing",
  "delegated-customer",
] as const

/** Stable promotion classifications agreed by policy. */
export const promoteClassifications = [
  "personal-message",
  "explicit-action",
  "scheduling-exception",
  "account-security",
  "operational-failure",
  "medical-action",
  "financial-anomaly",
  "service-decision",
  "active-work",
] as const
