/** Identify harness-injected user-role context that is not a user message. */
export function isInjectedContext(
  /** Candidate input text. */
  text: string,
) {
  const trimmed = text.trimStart()

  return [
    "<recommended_plugins>",
    "# AGENTS.md instructions",
    "<environment_context>",
    "<skill>",
    "<turn_aborted>",
  ].some(prefix => trimmed.startsWith(prefix))
}
