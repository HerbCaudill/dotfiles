<#
.SYNOPSIS
Install an immutable managed primary startup release during a coordinated stopped-runtime window.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $ConfigPath,
    [Parameter(Mandatory)][string] $ReleaseName
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($ReleaseName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]+$') { throw 'Use a unique commit-based release name.' }
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$taskName = 'DevResults site'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task -and $task.State -eq 'Running') { throw 'Primary task is running. Coordinate a stopped-runtime handoff first.' }
$ports = @(8443, 10000, 10001, 10002)
if (@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -in $ports).Count) {
    throw 'Primary listeners still exist. Preserve them; coordinate handoff before installing.'
}
if (($config.ports -join ',') -ne '10000,10001,10002' -or $config.iisPort -ne 8443) { throw 'Installer is for primary ports only.' }
$expectedData = 'C:\Code\DevResults\devresults\DevResults\.azurite\data'
$expectedDebug = 'C:\Code\DevResults\devresults\DevResults\azurite_debug.log'
if ($config.dataPath -ne $expectedData -or $config.debugLogPath -ne $expectedDebug) { throw 'Primary data/debug paths must be preserved.' }
foreach ($path in @($config.dataPath, $config.app.executable)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Required installed path unavailable: $path" }
}
$selected = $null
foreach ($candidate in $config.candidates) {
    if (-not (Test-Path -LiteralPath $candidate.node) -or -not (Test-Path -LiteralPath $candidate.entry)) { continue }
    # The same bounded offline verification used at startup; never invoke a package manager.
    $verify = "import {selectInstalledAzurite} from './supervisePrimarySite.ts'; await selectInstalledAzurite(JSON.parse(process.argv[1]));"
    Push-Location $PSScriptRoot
    try { & $candidate.node --input-type=module -e $verify (ConvertTo-Json -InputObject @($candidate) -Compress); $code = $LASTEXITCODE } finally { Pop-Location }
    if ($code -eq 0) { $selected = $candidate; break }
}
if (-not $selected) { throw 'No verified installed Azurite; provision a complete executable separately.' }
$release = Join-Path $env:LOCALAPPDATA "devresults-site\releases\$ReleaseName"
if (Test-Path -LiteralPath $release) { throw 'Release already exists; never overwrite a running release.' }
New-Item -ItemType Directory -Path $release -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'supervisePrimarySite.ts'), (Join-Path $PSScriptRoot 'start-site.ts') -Destination $release
Copy-Item -LiteralPath $ConfigPath -Destination (Join-Path $release 'primary.json')
$action = New-ScheduledTaskAction -Execute $selected.node -Argument ('"' + (Join-Path $release 'start-site.ts') + '" "' + (Join-Path $release 'primary.json') + '"') -WorkingDirectory $release
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT1M'
$principal = New-ScheduledTaskPrincipal -UserId 'herb' -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Installed $release. Task was not started. Start it only after coordinated recovery handoff; inspect status.json and child logs."
