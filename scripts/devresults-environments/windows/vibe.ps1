param($Request)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Write-State([string]$Path,$Value){$temp="$Path.tmp";[IO.File]::WriteAllText($temp,($Value|ConvertTo-Json -Depth 30));if(Test-Path $Path){[IO.File]::Replace($temp,$Path,[NullString]::Value)}else{[IO.File]::Move($temp,$Path)}}
function Assert-Owner($Value){if($Value.environmentId -cne $m.id -or $Value.ownerToken -cne $m.ownerToken){throw 'Foreign VibeResults owner'}}
function Get-State {if(Test-Path $statePath){$stream=[IO.File]::Open($statePath,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete));$reader=[IO.StreamReader]::new($stream);try{$s=$reader.ReadToEnd()|ConvertFrom-Json}finally{$reader.Dispose();$stream.Dispose()};Assert-Owner $s;return $s};return $null}
function Test-Live($State){if($null -eq $State -or $State.pid -le 0){return $false};$p=Get-Process -Id $State.pid -ErrorAction SilentlyContinue;if($null -eq $p){return $false};$c=Get-CimInstance Win32_Process -Filter "ProcessId=$($State.pid)";if($p.StartTime.ToUniversalTime().ToString('o') -cne $State.startedAt -or $c.CommandLine.IndexOf($State.request,[StringComparison]::OrdinalIgnoreCase) -lt 0){if($State.status -in @('installed','stopped','failed')){return $false};throw 'VibeResults PID was reused; no process was stopped'};return $true}
function Get-Task($State){$t=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue;if($t){if($null -eq $State){throw 'VibeResults task has no owned state'};$expected='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path (Split-Path $State.request) 'runner.ps1')+'" -RequestPath "'+$State.request+'"';if(@($t.Actions).Count -ne 1 -or $t.Actions[0].Execute -ine $pwsh -or $t.Actions[0].Arguments -cne $expected -or $t.Principal.RunLevel -ne 'Limited' -or $t.Principal.LogonType -ne 'S4U'){throw 'Foreign VibeResults task action or principal'}};return $t}
function Stop-Worker {
    $s=Get-State;$t=Get-Task $s
    if(Test-Live $s){Write-State (Join-Path (Split-Path $s.request) 'stop.json') @{ownerToken=$m.ownerToken;runId=$s.runId};for($i=0;$i -lt 100 -and (Test-Live $s);$i++){Start-Sleep -Milliseconds 300};if(Test-Live $s){throw 'VibeResults worker did not stop; inspect owned task'}}
    $s=Get-State;$t=Get-Task $s
    if($t -and $t.State -in @('Queued','Running')){for($i=0;$i -lt 50 -and $t.State -in @('Queued','Running');$i++){Start-Sleep -Milliseconds 100;$t=Get-Task $s};if($t.State -in @('Queued','Running')){throw 'VibeResults task launch remains ambiguous'}}
    if(-not $isWatch -and (Get-NetTCPConnection -LocalPort $m.ports.vibe -State Listen -ErrorAction SilentlyContinue)){throw 'VibeResults port remains occupied; no foreign process was stopped'}
}
try {
    $m=$Request.manifest
    $isWatch=$Request.PSObject.Properties.Name -contains 'clientWatch' -and $Request.clientWatch
    if($isWatch){$m|Add-Member -NotePropertyName vibe -NotePropertyValue @{path=$m.paths.windows} -Force}
    $path=[string]$m.vibe.path
    $root=Split-Path (Split-Path $m.paths.runtime)
    if($path -cne $(if($isWatch){$m.paths.windows}else{Join-Path $root "vibe\$($m.id)"})){throw 'Foreign VibeResults path'}
    $control="$path.drenv-source"
    $owner=Get-Content (Join-Path $control 'owner.json') -Raw|ConvertFrom-Json;Assert-Owner $owner
    if($owner.path -cne $path){throw 'Foreign VibeResults source mapping'}
    $common=((& git -C $path rev-parse --path-format=absolute --git-common-dir)-join '').Trim()
    if($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($common) -ine (Join-Path $control 'repository.git')){throw 'Foreign VibeResults Git store'}
    $statePath=Join-Path $control $(if($isWatch){'client-watch-state.json'}else{'vibe-state.json'})
    $taskName="drenv-$(if($isWatch){'watch'}else{'vibe'})-$($m.id)-$($m.ownerToken)"
    $pwsh='C:\Program Files\PowerShell\7\pwsh.exe'
    $state=Get-State
    $task=Get-Task $state
    $result=@{ok=$true;environmentId=$m.id;ownerToken=$m.ownerToken;status='stopped';state=$state;path=$path;port=$(if($isWatch){0}else{$m.ports.vibe});revision=((& git -C $path rev-parse HEAD)-join '').Trim()}
    if($Request.operation -eq 'status'){if(Test-Live $state){$result.status=$state.status};$result|ConvertTo-Json -Depth 30 -Compress;return}
    if($Request.operation -in @('preflight-remove','remove')){if(((& git -C $path status --porcelain --untracked-files=all)-join '') -or $LASTEXITCODE -ne 0){throw 'VibeResults worktree is dirty; preserve its edits before removal'}}
    if($Request.operation -eq 'preflight-remove'){$result|ConvertTo-Json -Depth 30 -Compress;return}
    if($Request.operation -in @('stop','remove','remove-task')){Stop-Worker;if($Request.operation -eq 'remove-task' -and $task){Unregister-ScheduledTask -TaskName $taskName -Confirm:$false};if($Request.operation -eq 'remove'){if($task){Unregister-ScheduledTask -TaskName $taskName -Confirm:$false};& git -C (Join-Path $control 'repository.git') worktree remove --force -- $path 2>$null;if($LASTEXITCODE -ne 0){throw 'Owned VibeResults source removal failed; preserved receipt'};Remove-Item -LiteralPath $control -Recurse -Force};$result|ConvertTo-Json -Depth 30 -Compress;return}
    if($Request.operation -eq 'start' -and (Test-Live $state) -and $state.status -eq 'running'){$result.status='running';$result|ConvertTo-Json -Depth 30 -Compress;return}
    $lockfile=Join-Path $path 'pnpm-lock.yaml'
    $hash=(Get-FileHash $lockfile -Algorithm SHA256).Hash
    $install=Join-Path $control 'installed.json'
    if($Request.operation -eq 'prepare' -and (Test-Path $install)){if((Get-Content $install -Raw|ConvertFrom-Json).lockHash -ceq $hash){$result.status='installed';$result|ConvertTo-Json -Depth 30 -Compress;return}}
    if(-not $isWatch -and $Request.operation -eq 'start' -and (-not(Test-Path $install) -or (Get-Content $install -Raw|ConvertFrom-Json).lockHash -cne $hash)){throw 'VibeResults dependencies changed; run install-vibe before starting'}
    Stop-Worker
    if($task){Unregister-ScheduledTask -TaskName $taskName -Confirm:$false}
    $runId=[guid]::NewGuid().ToString('N');$run=Join-Path $control $runId
    New-Item -ItemType Directory $run|Out-Null
    [IO.File]::WriteAllText((Join-Path $run 'runner.ps1'),$Request.runner)
    [IO.File]::WriteAllText((Join-Path $run 'OwnedJob.cs'),$Request.job)
    if($isWatch){[IO.File]::WriteAllText((Join-Path $run 'nativeClientWatch.ts'),$Request.watch);[IO.File]::WriteAllText((Join-Path $run 'publishClientBuild.ts'),$Request.publish)}
    $requestPath=Join-Path $run 'request.json'
    Write-State $requestPath @{manifest=$m;operation=$(if($isWatch){'watch'}elseif($Request.operation -eq 'install'){'prepare'}else{$Request.operation});state=$statePath;runId=$runId;lockHash=$hash}
    Write-State $statePath @{environmentId=$m.id;ownerToken=$m.ownerToken;pid=0;status='queued';runId=$runId;request=$requestPath;startedAt=''}
    $action=New-ScheduledTaskAction -Execute $pwsh -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+(Join-Path $run 'runner.ps1')+'" -RequestPath "'+$requestPath+'"') -WorkingDirectory $path
    Register-ScheduledTask -TaskName $taskName -Action $action -Principal (New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Limited) -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::Zero) -MultipleInstances IgnoreNew)|Out-Null
    Start-ScheduledTask -TaskName $taskName
    for($i=0;$i -lt 3600;$i++){$state=Get-State;if($state.status -eq 'failed'){throw ('Owned VibeResults worker failed; see '+$run+'\worker.log')};if(($Request.operation -eq 'start' -and $state.status -eq 'running' -and (Test-Live $state)) -or ($Request.operation -in @('prepare','install') -and $state.status -eq 'installed')){$result.status=$state.status;$result.state=$state;$result|ConvertTo-Json -Depth 30 -Compress;return};Start-Sleep -Milliseconds 500}
    throw 'VibeResults worker timed out; task and receipts retained'
} catch { @{ok=$false;error=($_.Exception.Message -replace '[\r\n].*','')}|ConvertTo-Json -Compress }
