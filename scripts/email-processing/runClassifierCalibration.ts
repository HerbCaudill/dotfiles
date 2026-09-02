import { parseClassifierOutput } from "./parseClassifierOutput.ts"
import type {
  ClassifierCandidate,
  ClassifierInput,
  ClassifierOutput,
  PromotionCorrectionEvidence,
} from "./types.ts"

/** Run the canonical prompt against a fictional, Gmail-free policy matrix. */
export async function runClassifierCalibration(
  /** Isolated classifier boundary. */
  classify: (input: ClassifierInput) => Promise<unknown>,
  /** Stable audit and time context for the calibration run. */
  context: CalibrationContext,
): Promise<number> {
  const input = createCalibrationInput(context)
  const output = parseClassifierOutput(await classify(input))
  const mismatches = CALIBRATION_CASES.flatMap(calibrationCase => {
    const decision = output.decisions.find(
      candidateDecision => candidateDecision.messageId === calibrationCase.candidate.messageId,
    )
    if (!decision || !calibrationCase.allowedDecisions.includes(decision.decision)) {
      return [calibrationCase.candidate.messageId]
    }
    const evidence = `${decision.reason}\n${decision.policySignals.join("\n")}`
    return SENSITIVE_CALIBRATION_EVIDENCE_PATTERN.test(evidence)
      ? [`${calibrationCase.candidate.messageId}:sensitive-evidence`]
      : []
  })
  if (mismatches.length > 0) {
    throw new Error(`Classifier calibration failed: ${mismatches.join(", ")}`)
  }
  return CALIBRATION_CASES.length
}

/** Build one complete synthetic classifier input from stable run context. */
function createCalibrationInput(
  /** Stable audit and time context. */
  context: CalibrationContext,
): ClassifierInput {
  return {
    evaluatedAt: context.evaluatedAt,
    policyVersion: context.policyVersion,
    account: "herb@devresults.com",
    candidates: CALIBRATION_CASES.map(calibrationCase => calibrationCase.candidate),
  }
}

/** Create one synthetic candidate with conservative defaults. */
function createCandidate(
  /** Fields that distinguish the policy case. */
  overrides: Partial<ClassifierCandidate> &
    Pick<ClassifierCandidate, "messageId" | "subject" | "body">,
): ClassifierCandidate {
  const { messageId, subject, body, ...optionalOverrides } = overrides
  return {
    messageId,
    threadId: `${messageId}-thread`,
    receivedAt: "2026-09-02T09:55:00.000Z",
    sender: { name: "Example Service", address: "service@example.test" },
    recipients: [{ name: "Herb Caudill", address: "herb@devresults.com" }],
    subject,
    body,
    thread: [],
    category: "updates",
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
    ...optionalOverrides,
  }
}

const ROUTINE_DIGEST_REVERSAL: PromotionCorrectionEvidence = {
  timestamp: "2026-08-15T10:00:00.000Z",
  correction: "promotion-reversed",
  sender: { name: "Example Service", address: "service@example.test" },
  subject: "Monthly administrator digest",
  exactSender: true,
  priorClassification: "operational-failure",
  priorReason: "The digest repeated an older service failure.",
  priorPolicySignals: ["operational-failure"],
}

const CALIBRATION_CASES: CalibrationCase[] = [
  {
    candidate: createCandidate({
      messageId: "routine-verification-code",
      subject: "Your verification code is 482019",
      body: "Use this one-time code to finish signing in. It expires in ten minutes.",
    }),
    allowedDecisions: ["none"],
  },
  {
    candidate: createCandidate({
      messageId: "fresh-security-incident",
      subject: "We blocked a risky sign-in",
      body: "At 09:48 today we blocked a sign-in from a new device. Review your account now if this was not you.",
    }),
    allowedDecisions: ["promote"],
  },
  {
    candidate: createCandidate({
      messageId: "stale-operational-digest",
      subject: "Monthly administrator digest",
      body: "Here is what you missed. On August 5, the accounting sync reported that its old refresh token was invalid. There are no new updates or requests.",
    }),
    allowedDecisions: ["none"],
  },
  {
    candidate: createCandidate({
      messageId: "fresh-operational-failure",
      subject: "Accounting synchronization failed",
      body: "The production accounting synchronization failed at 09:52 today. Reconnect the account to restore service.",
    }),
    allowedDecisions: ["promote"],
  },
  {
    candidate: createCandidate({
      messageId: "same-purpose-after-reversal",
      subject: "Monthly administrator digest",
      body: "This monthly digest repeats the August 5 accounting synchronization warning with no new development.",
      promotionCorrections: [ROUTINE_DIGEST_REVERSAL],
    }),
    allowedDecisions: ["none"],
  },
  {
    candidate: createCandidate({
      messageId: "different-critical-event-after-reversal",
      subject: "Immediate action required: account compromised",
      body: "We detected and blocked an account takeover attempt at 09:50 today. Reset the administrator password immediately.",
      promotionCorrections: [ROUTINE_DIGEST_REVERSAL],
    }),
    allowedDecisions: ["promote"],
  },
  {
    candidate: createCandidate({
      messageId: "delegated-customer",
      subject: "Request for a product demonstration",
      body: "Our organization would like a product demonstration. Please have your sales team contact us.",
      recipients: [
        { name: "Herb Caudill", address: "herb@devresults.com" },
        { name: "Sales", address: "sales@devresults.com" },
      ],
      delegatedCustomer: {
        customerInquiry: true,
        otherDevResultsRecipient: true,
        requiresHerbAction: false,
      },
    }),
    allowedDecisions: ["archive"],
  },
  {
    candidate: createCandidate({
      messageId: "delegated-customer-requires-herb",
      subject: "Herb, approve the procurement response",
      body: "Herb, please approve our procurement response by tomorrow.",
      recipients: [
        { name: "Herb Caudill", address: "herb@devresults.com" },
        { name: "Sales", address: "sales@devresults.com" },
      ],
      delegatedCustomer: {
        customerInquiry: true,
        otherDevResultsRecipient: true,
        requiresHerbAction: true,
      },
    }),
    allowedDecisions: ["promote"],
  },
]

/** Synthetic secrets or sensitive numeric details that must not appear in classifier evidence. */
const SENSITIVE_CALIBRATION_EVIDENCE_PATTERN = /\b482019\b/

type CalibrationContext = Pick<ClassifierInput, "evaluatedAt" | "policyVersion">

type CalibrationCase = {
  /** Fictional classifier candidate. */
  candidate: ClassifierCandidate
  /** Policy actions accepted for the candidate. */
  allowedDecisions: ClassifierOutput["decisions"][number]["decision"][]
}
