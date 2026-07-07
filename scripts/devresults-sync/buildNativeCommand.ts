import { quotePowerShell } from "./quotePowerShell.ts"

/** Build a PowerShell native-command invocation that preserves exit codes. */
export function buildNativeCommand(
  /** The command and arguments to invoke */
  args: string[],
) {
  const invocation = `& ${args.map(quotePowerShell).join(" ")}`

  return `${invocation}; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`
}
