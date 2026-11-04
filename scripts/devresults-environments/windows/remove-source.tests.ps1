param([string]$ScriptPath,[string]$ProvisionPath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=Join-Path $env:TEMP ('drenv-source-remove-'+[guid]::NewGuid().ToString('N'))
$helpers=[IO.File]::ReadAllText($ProvisionPath)
. ([ScriptBlock]::Create($helpers.Substring(0,$helpers.IndexOf('if ($null -eq $Request)'))))
$lifecycle=[IO.File]::ReadAllText($ScriptPath)
. ([ScriptBlock]::Create($lifecycle.Substring($lifecycle.IndexOf('function Quote-Argument'),$lifecycle.IndexOf('$lock=$null')-$lifecycle.IndexOf('function Quote-Argument'))))
function Stop-OwnedSupervisor($Manifest) {}
function Assert-Catalog($Manifest) {return $false}
function Get-OwnedFirewall($Manifest) {return $null}
function Get-ScheduledTask {param($TaskName,$ErrorAction);return $null}
function netsh {$global:LASTEXITCODE=1}
try {
    $path=Join-Path $root 'source\proof'
    $control="$path.drenv-source"
    $seed=Join-Path $root 'seed'
    [void][IO.Directory]::CreateDirectory($seed)
    [void][IO.Directory]::CreateDirectory($control)
    [IO.File]::WriteAllText((Join-Path $seed '.gitignore'),"node_modules/`n")
    & git init -q $seed
    & git -C $seed add .gitignore
    & git -C $seed -c user.name=Codex -c user.email=codex@localhost commit -qm fixture
    $store=Join-Path $control 'repository.git'
    & git clone --bare --quiet --no-hardlinks -- $seed $store
    & git -C $store config core.longpaths false
    & git -C $store worktree add --quiet --detach -- $path HEAD
    if($LASTEXITCODE -ne 0){throw 'Source fixture setup failed'}
    $foreign=Join-Path $root 'foreign'
    [void][IO.Directory]::CreateDirectory($foreign)
    [IO.File]::WriteAllText((Join-Path $foreign 'preserve.txt'),'foreign')
    $modules=Join-Path $path 'node_modules'
    [void][IO.Directory]::CreateDirectory($modules)
    [void](New-Item -ItemType Junction -Path (Join-Path $modules 'foreign-link') -Target $foreign)
    $deep=$modules
    foreach($i in 1..12){$deep=Join-Path $deep ('dependency-'+('x'*30))}
    [void][IO.Directory]::CreateDirectory(('\\?\'+$deep))
    [IO.File]::WriteAllText(('\\?\'+(Join-Path $deep 'fixture.txt')),'owned')
    $m=[pscustomobject]@{id='proof';ownerToken='fixture';revision=((& git -C $path rev-parse HEAD)-join '').Trim();paths=@{windows=$path;runtime=(Join-Path $root 'runtime\proof')};ports=@{https=39990}}
    Write-JsonAtomic (Join-Path $control 'owner.json') @{environmentId=$m.id;ownerToken=$m.ownerToken;path=$path}
    # No deletion is allowed until Git verifies the complete worktree is clean.
    [IO.File]::WriteAllText((Join-Path $path 'uncommitted.txt'),'preserve')
    $refused=$false
    try{Remove-OwnedData $m $true}catch{$refused=$_.Exception.Message -like '*uncommitted*'}
    if(-not $refused -or -not(Test-Path (Join-Path $path 'uncommitted.txt'))){throw 'Dirty source was not preserved'}
    Remove-Item -LiteralPath (Join-Path $path 'uncommitted.txt')
    Remove-OwnedData $m $true
    Remove-OwnedData $m $true
    @{worktreeRemoved=(-not(Test-Path -LiteralPath $path));controlRemoved=(-not(Test-Path -LiteralPath $control));foreignPreserved=([IO.File]::ReadAllText((Join-Path $foreign 'preserve.txt')) -ceq 'foreign')}|ConvertTo-Json -Compress
} finally {
    if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
