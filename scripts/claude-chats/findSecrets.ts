/** List the kinds of secret in some text, never the values, so results are safe to log. */
export function findSecrets(
  /** Text to scan. */
  text: string,
): string[] {
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)
}

// CONSTANTS

const SECRET_PATTERNS = [
  { label: "Anthropic key", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { label: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9]{32,}/ },
  { label: "GitHub token", pattern: /\bghp_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/ },
  { label: "AWS key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "Slack token", pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}/ },
  { label: "Google key", pattern: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY/ },
  {
    label: "assigned credential",
    pattern: /(password|passwd|api[_ -]?key|secret)["' ]*[:=] *["']?[A-Za-z0-9_!@#$%^&*-]{8,}/i,
  },
  { label: "IBAN", pattern: /\b[A-Z]{2}[0-9]{2}( ?[0-9A-Z]{4}){4,6}\b/ },
]
