$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$installer = Join-Path $root 'install-primary-site.ps1'
$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$parseErrors) | Out-Null
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
# These stubs exercise deployment guards without touching any scheduled task or listener.
function Get-ScheduledTask { [pscustomobject]@{ State = $global:primaryFixtureTaskState } }
function Get-NetTCPConnection { $global:primaryFixtureListeners }
function Register-ScheduledTask { throw 'Unexpected registration' }
function New-Item { throw 'Unexpected filesystem mutation' }
function Assert-Refused([string]$Expected) {
    try { & $installer -ConfigPath (Join-Path $root 'primary.example.json') -ReleaseName 'fixture-only'; throw 'Installer did not refuse' }
    catch { if ($_.Exception.Message -notlike "*$Expected*") { throw } }
}
$global:primaryFixtureTaskState = 'Running'
$global:primaryFixtureListeners = @()
Assert-Refused 'Primary task is running'
$global:primaryFixtureTaskState = 'Ready'
$global:primaryFixtureListeners = @([pscustomobject]@{ LocalPort = 10000 })
Assert-Refused 'Primary listeners still exist'
Write-Host 'PASS: installer syntax, running-task refusal, occupied-primary-port refusal; no live mutation'
