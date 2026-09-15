import { readFile } from "node:fs/promises"
import { encodeWindowsScript } from "./encodeWindowsScript.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import type { RegistryOptions, ResourceInventory } from "./types.ts"

/** Discover current Windows listeners, HTTP.sys reservations and personal claims before allocation. */
export async function inventoryEnvironmentResources(
  /** Native host roots. */
  options: RegistryOptions,
): Promise<ResourceInventory> {
  const script = `$root=[Console]::In.ReadToEnd(); $ports=@(Get-NetTCPConnection -State Listen | Select-Object -ExpandProperty LocalPort); $text=((& netsh http show sslcert)+(& netsh http show urlacl)) -join "\n"; $ports+=@([regex]::Matches($text,':(\\d+)(?:/|\\s|$)') | ForEach-Object {[int]$_.Groups[1].Value}); if(Test-Path -LiteralPath "$root\\claims"){Get-ChildItem -LiteralPath "$root\\claims" -Filter '*.json' | ForEach-Object {$ports+=@((Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json).ports)}}; ConvertTo-Json -Compress -InputObject @($ports | Sort-Object -Unique)`
  const remote = await runDrenvCommand({
    executable: "ssh",
    args: [
      options.windowsHost,
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodeWindowsScript(script),
    ],
    input: options.windowsRoot,
  })
  // lsof exits 1 when no sockets match. Asking for all TCP sockets avoids treating that as a failed inventory.
  const local = await runDrenvCommand({ executable: "lsof", args: ["-nP", "-iTCP", "-Fn"] })
  const macPorts = [...local.stdout.matchAll(/^n.*:(\d+)(?:->|$)/gm)].map(match => Number(match[1]))
  return { windowsPorts: JSON.parse(remote.stdout.trim()), macPorts }
}
