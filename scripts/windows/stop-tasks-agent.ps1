param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  $child = Start-Process 'C:\Program Files\PowerShell\7\pwsh.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList "-NoProfile -NonInteractive -File `"$PSCommandPath`" -RepoRoot `"$RepoRoot`""
  exit $child.ExitCode
}
$entry = Join-Path $RepoRoot 'scripts\tasks-agent\windowsMain.ts'
$processes = @(Get-CimInstance Win32_Process)
$roots = @($processes | Where-Object {
  $_.Name -eq 'node.exe' -and $_.CommandLine -and
  ($_.CommandLine -replace '"', '').EndsWith("$entry serve", [StringComparison]::OrdinalIgnoreCase)
})
# Capture the owned descendants before stopping the scheduled PowerShell wrapper.
$owned = @($roots.ProcessId)
do {
  $children = @($processes | Where-Object { $_.ParentProcessId -in $owned -and $_.ProcessId -notin $owned })
  $owned += @($children.ProcessId)
} while ($children.Count)
if (Get-ScheduledTask -TaskName tasks-agent -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName tasks-agent
}
foreach ($processId in @($owned | Select-Object -Unique)) {
  $original = $processes | Where-Object ProcessId -eq $processId
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
  if ($current -and $current.CreationDate -eq $original.CreationDate) {
    Stop-Process -Id $processId -Force -ErrorAction Stop
  }
}
