param([string]$RepoRoot = 'C:\Code\HerbCaudill\dotfiles')
$ErrorActionPreference = 'Stop'
$node = Join-Path $env:LOCALAPPDATA 'mise\shims\node.exe'
$entry = Join-Path $RepoRoot 'scripts\google-workspace\runDelegatedGws.ts'
if (-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $entry)) {
  throw 'Install mise Node and the dotfiles checkout first.'
}
$bin = Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Path $bin -Force | Out-Null
$launcher = "@echo off`r`n`"$node`" --experimental-strip-types `"$entry`" %*`r`n"
[IO.File]::WriteAllText((Join-Path $bin 'gws-delegated.cmd'), $launcher, [Text.UTF8Encoding]::new($false))
Write-Output 'Installed gws-delegated. Its existing delegated credential must be installed separately with private Windows ACLs.'
