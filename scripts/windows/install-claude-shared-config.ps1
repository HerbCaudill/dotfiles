param(
  [string]$RepoRoot = "\\Mac\Home\Code\HerbCaudill\dotfiles",
  [string]$UserProfile = $env:USERPROFILE,
  [switch]$Copy
)

$ErrorActionPreference = "Stop"

$claudeDirectory = Join-Path $UserProfile ".claude"
$settingsPath = Join-Path $claudeDirectory "settings.json"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$items = @(
  @{ Name = "CLAUDE.md"; Source = Join-Path $RepoRoot "home\.claude\CLAUDE.md" },
  @{ Name = "agents"; Source = Join-Path $RepoRoot "home\.claude\agents" },
  @{ Name = "skills"; Source = Join-Path $RepoRoot "home\.claude\skills" },
  @{ Name = "statusline.js"; Source = Join-Path $RepoRoot "home\.claude\statusline.js" }
)

function Backup-ExistingItem {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) { return }

  $item = Get-Item -LiteralPath $Path -Force
  if ($item.LinkType -eq "SymbolicLink") {
    Remove-Item -LiteralPath $Path -Force
    return
  }

  $backupPath = "$Path.backup-$timestamp"
  Move-Item -LiteralPath $Path -Destination $backupPath
  Write-Host "Backed up $Path to $backupPath"
}

function Install-SharedItem {
  param(
    [string]$Name,
    [string]$Source
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Missing source item: $Source"
  }

  $target = Join-Path $claudeDirectory $Name
  Backup-ExistingItem -Path $target

  if ($Copy) {
    Copy-Item -LiteralPath $Source -Destination $target -Recurse
    Write-Host "Copied $Name"
    return
  }

  try {
    New-Item -ItemType SymbolicLink -Path $target -Target $Source | Out-Null
    Write-Host "Linked $Name -> $Source"
  } catch {
    throw "Could not create symlink for $Name. Re-run this script as Administrator, enable Developer Mode, or use -Copy. Original error: $_"
  }
}

function Read-Settings {
  if (-not (Test-Path -LiteralPath $settingsPath)) { return [pscustomobject]@{} }

  $raw = Get-Content -LiteralPath $settingsPath -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { return [pscustomobject]@{} }

  return $raw | ConvertFrom-Json
}

function Write-StatusLineSettings {
  $settings = Read-Settings
  $settings | Add-Member -Force -NotePropertyName statusLine -NotePropertyValue ([ordered]@{
    type = "command"
    command = "node ~/.claude/statusline.js"
  })

  $settings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $settingsPath -Encoding utf8
  Write-Host "Updated $settingsPath"
}

New-Item -ItemType Directory -Path $claudeDirectory -Force | Out-Null

foreach ($item in $items) {
  Install-SharedItem -Name $item.Name -Source $item.Source
}

Write-StatusLineSettings
Write-Host "Claude now uses repo-managed skills, agents, global instructions, and status line assets."
