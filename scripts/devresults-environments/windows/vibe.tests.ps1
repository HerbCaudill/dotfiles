param([string]$ScriptPath)
$ErrorActionPreference='Stop'
$env:PSModulePath="$env:SystemRoot\System32\WindowsPowerShell\v1.0\Modules"
$root=Join-Path $env:TEMP ('drenv-vibe-fixture-'+[guid]::NewGuid().ToString('N'))
$script:launches=0
function git {$global:LASTEXITCODE=0;if($args[-1] -eq 'HEAD'){return ('a'*40)};return (Join-Path $control 'repository.git')}
function Get-ScheduledTask {param($TaskName,$ErrorAction) return $null}
function Get-NetTCPConnection {param($LocalPort,$State,$ErrorAction) return $null}
function New-ScheduledTaskAction {param($Execute,$Argument,$WorkingDirectory) return @{Execute=$Execute}}
function New-ScheduledTaskPrincipal {param($UserId,$LogonType,$RunLevel) return @{LogonType=$LogonType;RunLevel=$RunLevel}}
function New-ScheduledTaskSettingsSet {param($ExecutionTimeLimit,$MultipleInstances) return @{}}
function Register-ScheduledTask {
    param($TaskName,$Action,$Principal,$Settings)
    if($Principal.RunLevel -ne 'Limited' -or $Principal.LogonType -ne 'S4U'){throw 'Install worker must remain limited S4U'}
}
function Start-ScheduledTask {
    param($TaskName)
    $script:launches++
    Write-State $statePath @{environmentId=$m.id;ownerToken=$m.ownerToken;pid=0;status='installed'}
}
try {
    $results=@(foreach($operation in @('prepare','install')) {
        $id=$operation
        $path=Join-Path $root "vibe\$id"
        $control="$path.drenv-source"
        [void][IO.Directory]::CreateDirectory($path)
        [void][IO.Directory]::CreateDirectory($control)
        [IO.File]::WriteAllText((Join-Path $path 'pnpm-lock.yaml'),'fixture')
        @{environmentId=$id;ownerToken='fixture';path=$path}|ConvertTo-Json|Set-Content (Join-Path $control 'owner.json')
        @{lockHash=(Get-FileHash (Join-Path $path 'pnpm-lock.yaml') -Algorithm SHA256).Hash}|ConvertTo-Json|Set-Content (Join-Path $control 'installed.json')
        $manifest=[pscustomobject]@{id=$id;ownerToken='fixture';paths=@{runtime=(Join-Path $root "runtime\$id")};vibe=@{path=$path};ports=@{vibe=39990}}
        $request=[pscustomobject]@{manifest=$manifest;operation=$operation;runner='fixture';job='fixture'}
        $script:launches=0
        $result=& ([ScriptBlock]::Create([IO.File]::ReadAllText($ScriptPath))) -Request $request|ConvertFrom-Json
        if(-not $result.ok){throw 'Vibe fixture command failed'}
        @{operation=$operation;status=$result.status;launches=$script:launches}
    })
    $results|ConvertTo-Json -Compress
} finally {
    $resolved=[IO.Path]::GetFullPath($root)
    if(-not $resolved.StartsWith([IO.Path]::GetFullPath($env:TEMP),[StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -cnotmatch '^drenv-vibe-fixture-[a-f0-9]{32}$'){throw 'Unsafe fixture cleanup path'}
    if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
