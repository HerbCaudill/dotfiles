/** Select the repo-owned job while retaining the stable Full Disk Access launcher. */
export function getBriefingInvocation(
  /** Arguments forwarded by the trusted launcher. */
  arguments_: string[],
): { entrypoint: string; arguments: string[] } {
  const sources = arguments_[0] === "--mac-sources"
  return {
    entrypoint: `/Users/herbcaudill/Code/HerbCaudill/leo/scripts/${sources ? "mac-sources" : "morning-briefing"}/run.ts`,
    arguments: sources ? arguments_.slice(1) : arguments_,
  }
}
