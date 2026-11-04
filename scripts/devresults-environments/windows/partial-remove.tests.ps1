param([string]$ScriptPath)
$ErrorActionPreference='Stop'
$root=Join-Path $env:TEMP ('drenv-partial-remove-'+[guid]::NewGuid().ToString('N'))
$script:passed=0
function Check($Condition,$Message){if(-not $Condition){throw $Message};$script:passed++}
function Get-ScheduledTask {param($TaskName,$ErrorAction);return $null}
function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction);return $null}
try {
    foreach($watch in @($false,$true)) {
        $path=Join-Path $root $(if($watch){'source\proof'}else{'vibe\proof'})
        $control="$path.drenv-source"
        [void][IO.Directory]::CreateDirectory($control)
        $owner=@{environmentId='proof';ownerToken='fixture';path=$path}
        $owner|ConvertTo-Json|Set-Content (Join-Path $control 'owner.json')
        $m=[pscustomobject]@{id='proof';ownerToken='fixture';paths=@{windows=$path;runtime=(Join-Path $root 'runtime\proof')};vibe=@{path=$path};ports=@{vibe=39990}}
        foreach($operation in @('stop','status','preflight-remove',$(if($watch){'remove-task'}else{'remove'}),'stop')) {
            $request=[pscustomobject]@{manifest=$m;operation=$operation;clientWatch=$watch}
            $result=& ([ScriptBlock]::Create([IO.File]::ReadAllText($ScriptPath))) -Request $request|ConvertFrom-Json
            Check $result.ok "Missing worktree failed $operation (watch=$watch): $($result.error)"
        }
        [void][IO.Directory]::CreateDirectory($control)
        $owner.ownerToken='foreign'
        $owner|ConvertTo-Json|Set-Content (Join-Path $control 'owner.json')
        $request=[pscustomobject]@{manifest=$m;operation='stop';clientWatch=$watch}
        $result=& ([ScriptBlock]::Create([IO.File]::ReadAllText($ScriptPath))) -Request $request|ConvertFrom-Json
        Check (-not $result.ok -and $result.error -like '*owner*') 'Missing worktree bypassed a surviving foreign receipt'
        $owner.ownerToken='fixture'
        $owner|ConvertTo-Json|Set-Content (Join-Path $control 'owner.json')
        [void][IO.Directory]::CreateDirectory($path)
        & git init -q $path
        $result=& ([ScriptBlock]::Create([IO.File]::ReadAllText($ScriptPath))) -Request $request|ConvertFrom-Json
        Check (-not $result.ok -and $result.error -like '*Git store*') 'Existing foreign Git store was accepted'
        Remove-Item -LiteralPath $path -Recurse -Force
        & {
            function Get-ScheduledTask {param($TaskName,$ErrorAction);return [pscustomobject]@{State='Ready'}}
            $result=& ([ScriptBlock]::Create([IO.File]::ReadAllText($ScriptPath))) -Request $request|ConvertFrom-Json
            Check (-not $result.ok -and $result.error -like '*owned state*') 'Missing worktree bypassed an unowned scheduled task'
        }
    }
    @{passed=$script:passed}|ConvertTo-Json -Compress
} finally {
    if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
