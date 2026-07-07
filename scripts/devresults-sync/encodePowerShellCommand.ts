/** Encode a PowerShell command for powershell.exe -EncodedCommand. */
export function encodePowerShellCommand(
  /** The PowerShell command text */
  command: string,
) {
  return Buffer.from(command, "utf16le").toString("base64")
}
