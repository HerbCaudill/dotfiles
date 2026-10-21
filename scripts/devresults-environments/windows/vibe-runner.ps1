param([string]$RequestPath)
$ErrorActionPreference='Stop'
$r=Get-Content $RequestPath -Raw|ConvertFrom-Json
$m=$r.manifest
$run=Split-Path $RequestPath
$state=@{environmentId=$m.id;ownerToken=$m.ownerToken;runId=$r.runId;request=$RequestPath;pid=$PID;startedAt=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o');status='starting';log=(Join-Path $run 'worker.log')}
function Save {$temp="$($r.state).$($r.runId).tmp";[IO.File]::WriteAllText($temp,($state|ConvertTo-Json -Depth 20));[IO.File]::Replace($temp,$r.state,[NullString]::Value)}
$job=$null
try {
    Save
    $owner=Get-Content "$($m.vibe.path).drenv-source\owner.json" -Raw|ConvertFrom-Json
    if($owner.environmentId -cne $m.id -or $owner.ownerToken -cne $m.ownerToken -or $owner.path -cne $m.vibe.path){throw 'Foreign VibeResults worker ownership'}
    $env:Path="$env:USERPROFILE\AppData\Local\mise\shims;$env:USERPROFILE\AppData\Local\mise\bin;"+[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
    $env:MISE_TRUSTED_CONFIG_PATHS=$m.vibe.path
    $env:DEVRESULTS_ORIGIN="https://$($m.data.instance).devlocal.us:$($m.ports.https)"
    if($r.operation -ne 'watch'){$env:APP_HTTPS_PORT=[string]$m.ports.vibe}
    $env:BROWSER='none'
    $env:APP_E2E_API_FIXTURE=$null;$env:APP_PARITY_TOKEN=$null
    Add-Type -Path (Join-Path $run 'OwnedJob.cs')
    $job=[DrenvOwnedJob]::new("Local\drenv-vibe-$($m.ownerToken)-$($r.runId)")
    $command=if($r.operation -eq 'prepare'){'pnpm.cmd install --frozen-lockfile'}elseif($r.operation -eq 'watch'){'node --experimental-strip-types "'+(Join-Path $run 'nativeClientWatch.ts')+'" "'+$RequestPath+'"'}else{'pnpm.cmd dev'}
    $text="& mise exec node@24 -- $command *> '"+$state.log.Replace("'","''")+"';exit `$LASTEXITCODE"
    $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($text))
    $child=$job.Spawn('C:\Program Files\PowerShell\7\pwsh.exe',('-NoProfile -NonInteractive -EncodedCommand '+$encoded),$m.vibe.path)
    if($r.operation -eq 'prepare'){
        if($job.Wait($child) -ne 0){throw 'Dependency install failed'}
        $temp="$($m.vibe.path).drenv-source\installed.tmp"
        [IO.File]::WriteAllText($temp,(@{lockHash=$r.lockHash;environmentId=$m.id;ownerToken=$m.ownerToken}|ConvertTo-Json))
        Move-Item $temp "$($m.vibe.path).drenv-source\installed.json" -Force
        $state.status='installed'
    } else {
        $ready=$false
        for($i=0;$i -lt 180;$i++){
            if(-not $job.IsAlive($child)){throw 'Vite exited during startup'}
            if($r.operation -eq 'watch'){if(Test-Path (Join-Path $run 'ready.json')){$ready=$true;break};Start-Sleep -Milliseconds 500;continue}
            $listeners=@(Get-NetTCPConnection -LocalPort $m.ports.vibe -State Listen -ErrorAction SilentlyContinue)
            if($listeners.Count -gt 0){if(@($listeners|Where-Object {-not $job.Owns([int]$_.OwningProcess)}).Count){throw 'Foreign VibeResults listener'};$ready=$true;break}
            Start-Sleep -Milliseconds 500
        }
        if(-not $ready){throw 'Vite listener did not become ready'}
        $state.status='running';Save
        while($true){if(Test-Path (Join-Path $run 'stop.json')){$stop=Get-Content (Join-Path $run 'stop.json') -Raw|ConvertFrom-Json;if($stop.ownerToken -ceq $m.ownerToken -and $stop.runId -ceq $r.runId){break}};if(-not $job.IsAlive($child)){throw 'Vite exited'};Start-Sleep -Milliseconds 300}
        $state.status='stopped'
    }
} catch {$state.status='failed';$state.failure='Owned worker failed; inspect private worker.log'}
finally {if($job){$job.Dispose()};Save}
