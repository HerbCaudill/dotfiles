param([string]$ScriptPath,[string]$CleanupPath)
$ErrorActionPreference='Stop'
$root=Join-Path $env:TEMP ('drenv-vibe-remove-'+[guid]::NewGuid().ToString('N'))
function Get-ScheduledTask {param($TaskName,$ErrorAction) return $null}
function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction) return $null}
try {
    $path=Join-Path $root 'vibe\proof'
    $control="$path.drenv-source"
    $seed=Join-Path $root 'seed'
    [void][IO.Directory]::CreateDirectory($seed)
    [void][IO.Directory]::CreateDirectory($control)
    [IO.File]::WriteAllText((Join-Path $seed '.gitignore'),"node_modules/`n")
    & git init -q $seed
    & git -C $seed add .gitignore
    & git -C $seed -c user.name=Codex -c user.email=codex@localhost commit -qm fixture
    & git clone --bare --quiet --no-hardlinks -- $seed (Join-Path $control 'repository.git')
    & git -C (Join-Path $control 'repository.git') config core.longpaths false
    & git -C (Join-Path $control 'repository.git') worktree add --quiet --detach -- $path HEAD
    if($LASTEXITCODE -ne 0){throw 'Fixture Git setup failed'}
    $foreign=Join-Path $root 'foreign'
    [void][IO.Directory]::CreateDirectory($foreign)
    [IO.File]::WriteAllText((Join-Path $foreign 'preserve.txt'),'foreign')
    $modules=Join-Path $path 'node_modules'
    [void][IO.Directory]::CreateDirectory($modules)
    [void](New-Item -ItemType Junction -Path (Join-Path $modules 'foreign-link') -Target $foreign)
    $deep=$modules
    foreach($i in 1..12){$deep=Join-Path $deep ('dependency-'+('x'*30))}
    [void][IO.Directory]::CreateDirectory($deep)
    [IO.File]::WriteAllText((Join-Path $deep 'fixture.txt'),'owned')
    @{environmentId='proof';ownerToken='fixture';path=$path}|ConvertTo-Json|Set-Content (Join-Path $control 'owner.json')
    $m=[pscustomobject]@{id='proof';ownerToken='fixture';paths=@{runtime=(Join-Path $root 'runtime\proof')};vibe=@{path=$path};ports=@{vibe=39990}}
    $request=[pscustomobject]@{manifest=$m;operation='remove';cleanup=[IO.File]::ReadAllText($CleanupPath)}
    $result=& ([ScriptBlock]::Create([IO.File]::ReadAllText($ScriptPath))) -Request $request|ConvertFrom-Json
    @{ok=$result.ok;worktreeRemoved=(-not(Test-Path -LiteralPath $path));foreignPreserved=([IO.File]::ReadAllText((Join-Path $foreign 'preserve.txt')) -ceq 'foreign')}|ConvertTo-Json -Compress
} finally {
    $resolved=[IO.Path]::GetFullPath($root)
    if(-not $resolved.StartsWith([IO.Path]::GetFullPath($env:TEMP),[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -cnotmatch '^drenv-vibe-remove-[a-f0-9]{32}$'){throw 'Unsafe fixture cleanup path'}
    if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
