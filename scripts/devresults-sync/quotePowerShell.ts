/** Quote a value as a PowerShell single-quoted string. */
export function quotePowerShell(
  /** The raw argument value */
  value: string,
) {
  return `'${value.replaceAll("'", "''")}'`
}
