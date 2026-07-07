import type { DrsyncArgs, DrsyncMode } from "./types.ts"

/** Parse drsync command-line arguments. */
export function parseDrsyncArgs(
  /** The raw command-line arguments after drsync */
  args: string[],
): DrsyncArgs {
  const mode = getMode(args)

  return {
    args: args.filter(arg => arg !== "--background" && arg !== "--worker"),
    mode,
  }
}

/** Get the requested drsync execution mode. */
function getMode(
  /** The raw command-line arguments after drsync */
  args: string[],
): DrsyncMode {
  if (args.includes("--background")) return "background"
  if (args.includes("--worker")) return "worker"

  return "foreground"
}
