$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Keep failure messages static: Git diagnostics can include private paths or repository content.
function Invoke-SourceGit {
    param([string]$Directory, [string[]]$Arguments)
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { $output = & git -C $Directory @Arguments 2>&1; $exitCode = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previousPreference }
    if ($exitCode -ne 0) { throw 'Git operation failed; inspect the owned source worktree directly' }
    return (($output | ForEach-Object { $_.ToString() }) -join "`n").Trim()
}

function Assert-NativePath {
    param([string]$Path)
    if ($Path -notmatch '^[A-Za-z]:\\[A-Za-z0-9_\\ .-]+$' -or [IO.Path]::GetFullPath($Path) -cne $Path) { throw 'Unsafe native source path' }
    $current = $Path
    while ($current) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing reparse point in source path' }
        }
        $parent = Split-Path -Parent $current
        if ($parent -eq $current) { break }
        $current = $parent
    }
}

function Write-SourceReceipt {
    param($Receipt, [string]$Path)
    $temporary = "$Path.tmp"
    [IO.File]::WriteAllText($temporary, ($Receipt | ConvertTo-Json -Compress))
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
    else { [IO.File]::Move($temporary, $Path) }
}

$lock = $null
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($request.environmentId -notmatch '^[a-z][a-z0-9-]{0,47}$' -or $request.ownerToken -notmatch '^[a-f0-9-]{36}$') { throw 'Invalid source identity' }
    if ($request.revision -notmatch '^[a-f0-9]{40,64}$' -or $request.ref -notmatch '^refs/drenv-transfer/[a-f0-9-]{36}/[a-f0-9-]{36}$' -or $request.upload -notmatch '^[a-f0-9-]{36}\.bundle$') { throw 'Invalid bundle identity' }
    if ($request.stage -notin @('prepare', 'apply') -or $request.operation -notin @('pair', 'sync')) { throw 'Invalid source operation' }
    $path = [string]$request.path
    Assert-NativePath $path
    $claim = "$path.drenv-source"
    $marker = Join-Path $claim 'owner.json'
    $repository = Join-Path $claim 'repository.git'
    $bundle = Join-Path $claim $request.upload
    Assert-NativePath $claim
    if (!(Test-Path -LiteralPath $claim)) {
        if ($request.operation -ne 'pair' -or $request.stage -ne 'prepare') { throw 'Missing owned source claim' }
        if (Test-Path -LiteralPath $path) { throw 'Refusing unowned Windows source destination' }
        $parent = Split-Path -Parent $claim
        if (!(Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        New-Item -ItemType Directory -Path $claim -ErrorAction Stop | Out-Null
        $receipt = [pscustomobject]@{ environmentId = $request.environmentId; ownerToken = $request.ownerToken; path = $path; revision = $request.revision; syncedRevision = $null }
        Write-SourceReceipt $receipt $marker
    }
    $lock = [IO.File]::Open((Join-Path $claim 'operation.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $receipt = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
    if ($receipt.environmentId -cne $request.environmentId -or $receipt.ownerToken -cne $request.ownerToken -or $receipt.path -cne $path) { throw 'Refusing foreign Windows source ownership' }
    if ($request.operation -eq 'pair' -and $receipt.revision -cne $request.revision) { throw 'Frozen Windows pairing revision changed' }
    Assert-NativePath $repository
    if (Test-Path -LiteralPath $path) {
        $common = Invoke-SourceGit $path @('rev-parse', '--path-format=absolute', '--git-common-dir')
        $top = Invoke-SourceGit $path @('rev-parse', '--show-toplevel')
        if ([IO.Path]::GetFullPath($common) -ine $repository -or [IO.Path]::GetFullPath($top) -ine $path) { throw 'Windows worktree mapping differs from ownership receipt' }
        if (Invoke-SourceGit $path @('status', '--porcelain', '--untracked-files=all')) { throw 'Windows source worktree is dirty; preserve or commit its changes before sync' }
        $head = Invoke-SourceGit $path @('rev-parse', 'HEAD')
        # A crash after merge but before receipt persistence is recoverable only at the requested commit.
        if ($head -cne $receipt.syncedRevision -and $head -cne $request.revision -and ($null -ne $receipt.syncedRevision -or $head -cne $receipt.revision)) { throw 'Windows source HEAD changed outside the recorded sync' }
    } elseif ($request.operation -eq 'sync') { throw 'Owned Windows source worktree is missing' }
    if ($request.stage -eq 'prepare') {
        @{ ok = $true } | ConvertTo-Json -Compress
    } else {
        if (!(Test-Path -LiteralPath $repository)) {
            New-Item -ItemType Directory -Path $repository | Out-Null
        }
        # Reinitialization safely resumes an interrupted init inside the owned private store.
        Invoke-SourceGit $repository @('init', '--bare') | Out-Null
        Invoke-SourceGit $repository @('bundle', 'verify', $bundle) | Out-Null
        Invoke-SourceGit $repository @('fetch', '--no-tags', $bundle, $request.ref) | Out-Null
        $fetched = Invoke-SourceGit $repository @('rev-parse', 'FETCH_HEAD^{commit}')
        if ($fetched -cne $request.revision) { throw 'Bundle commit does not match frozen source revision' }
        if (!(Test-Path -LiteralPath $path)) {
            Invoke-SourceGit $repository @('worktree', 'add', '--detach', '--', $path, $request.revision) | Out-Null
        } else {
            Invoke-SourceGit $path @('merge', '--ff-only', $request.revision) | Out-Null
        }
        $actual = Invoke-SourceGit $path @('rev-parse', 'HEAD')
        if ($actual -cne $request.revision -or (Invoke-SourceGit $path @('status', '--porcelain', '--untracked-files=all'))) { throw 'Windows source postcondition failed' }
        $receipt.syncedRevision = $actual
        Write-SourceReceipt $receipt $marker
        Remove-Item -LiteralPath $bundle
        @{ ok = $true; revision = $actual } | ConvertTo-Json -Compress
    }
} catch {
    # Only our static errors are surfaced; unexpected PowerShell diagnostics may contain sensitive data.
    $safe = @('Unsafe native source path', 'Refusing reparse point in source path', 'Invalid source identity', 'Invalid bundle identity', 'Invalid source operation', 'Missing owned source claim', 'Refusing unowned Windows source destination', 'Refusing foreign Windows source ownership', 'Frozen Windows pairing revision changed', 'Windows worktree mapping differs from ownership receipt', 'Windows source worktree is dirty; preserve or commit its changes before sync', 'Windows source HEAD changed outside the recorded sync', 'Owned Windows source worktree is missing', 'Bundle commit does not match frozen source revision', 'Windows source postcondition failed', 'Git operation failed; inspect the owned source worktree directly')
    $message = 'Source operation failed; inspect the owned claim, lock and Git prerequisites (line ' + $_.InvocationInfo.ScriptLineNumber + ', ' + $_.Exception.GetType().Name + ')'
    if ($safe -contains $_.Exception.Message) { $message = $_.Exception.Message }
    @{ ok = $false; error = $message } | ConvertTo-Json -Compress
} finally {
    if ($null -ne $lock) { $lock.Dispose() }
}
