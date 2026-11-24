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
  @{ Name = ".claude\CLAUDE.md"; Source = Join-Path $RepoRoot "home\.claude\AGENTS.md" },
  @{ Name = ".claude\skills"; Source = Join-Path $RepoRoot "home\.claude\skills" },
  @{ Name = ".claude\statusline.js"; Source = Join-Path $RepoRoot "home\.claude\statusline.js" },
  @{ Name = ".codex\AGENTS.md"; Source = Join-Path $RepoRoot "home\.claude\AGENTS.md" },
  @{ Name = ".codex\skills"; Source = Join-Path $RepoRoot "home\.claude\skills" }
)

function Remove-ExistingLink {
  param(
    [string]$Path,
    [bool]$IsDirectory
  )

  if ($IsDirectory) {
    cmd /c rmdir "$Path" | Out-Null
    return
  }

  cmd /c del "$Path" | Out-Null
}

function Backup-ExistingItem {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) { return }

  $item = Get-Item -LiteralPath $Path -Force
  if ($item.LinkType -eq "SymbolicLink" -or $item.LinkType -eq "Junction") {
    Remove-ExistingLink -Path $Path -IsDirectory $item.PSIsContainer
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

  $target = Join-Path $UserProfile $Name
  New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
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

# Windows OpenSSH rejects a config that other users can read, and files under C:\Code inherit
# access for Authenticated Users, so copy the repo's config into the private ~/.ssh instead of
# linking it. Re-run this script after changing home\.ssh\config.windows.
function Install-SshConfig {
  $source = Join-Path $RepoRoot "home\.ssh\config.windows"
  if (-not (Test-Path -LiteralPath $source)) { throw "Missing source item: $source" }

  $target = Join-Path $UserProfile ".ssh\config"
  New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
  Backup-ExistingItem -Path $target
  Get-Content -LiteralPath $source -Raw | Set-Content -LiteralPath $target -NoNewline -Encoding ascii
  Write-Host "Copied .ssh\config"
}

function Read-Json {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]@{} }

  $raw = Get-Content -LiteralPath $Path -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { return [pscustomobject]@{} }

  return $raw | ConvertFrom-Json
}

# Windows keeps its own settings.json (for example, the mini runs in bypassPermissions mode), so
# copy only the shared keys from the repo file. `env` carries CLAUDE_CODE_ENABLE_CFC, which turns on
# Claude in Chrome for non-interactive sessions such as the ones T3 Code starts.
function Write-SharedSettings {
  $sharedSettings = Read-Json -Path (Join-Path $RepoRoot "home\.claude\settings.json")
  $settings = Read-Json -Path $settingsPath

  foreach ($key in @("env", "statusLine")) {
    $value = $sharedSettings.$key
    if ($null -eq $value) { throw "Missing $key in the repo's home\.claude\settings.json" }

    if ($key -eq "env" -and $null -ne $settings.env) {
      # Keep machine-specific variables; repo values win on conflict.
      foreach ($variable in $value.PSObject.Properties) {
        $settings.env | Add-Member -Force -NotePropertyName $variable.Name -NotePropertyValue $variable.Value
      }
      continue
    }

    $settings | Add-Member -Force -NotePropertyName $key -NotePropertyValue $value
  }

  $settings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $settingsPath -Encoding utf8
  Write-Host "Updated $settingsPath"
}

New-Item -ItemType Directory -Path $claudeDirectory -Force | Out-Null

foreach ($item in $items) {
  Install-SharedItem -Name $item.Name -Source $item.Source
}

Install-SshConfig

Write-SharedSettings
Write-Host "Claude and Codex now use repo-managed skills and global instructions, plus the Claude status line, shared environment variables and SSH config."
