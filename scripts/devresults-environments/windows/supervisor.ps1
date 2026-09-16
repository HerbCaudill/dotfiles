param([string]$RequestPath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Save($Value) {
    $temporary="$($request.state).tmp"
    [IO.File]::WriteAllText($temporary,($Value | ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
    if(Test-Path -LiteralPath $request.state){[IO.File]::Replace($temporary,$request.state,[NullString]::Value)}else{[IO.File]::Move($temporary,$request.state)}
}
function Quote([string]$Value) { if($Value.Contains('"') -or $Value -match '[\r\n]'){throw 'Invalid process argument'}; return '"'+$Value+'"' }
$request = Get-Content -LiteralPath $RequestPath -Raw | ConvertFrom-Json
$m=$request.manifest
$job=$null
$diagnostic='Supervisor initialization or process containment failed'
$state=@{environmentId=$m.id; ownerToken=$m.ownerToken; revision=$m.revision; runId=$request.runId; mode=$request.mode; status='starting'; pid=$PID; processStartTime=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o'); request=$RequestPath; children=@()}
try {
    $owner=Get-Content -LiteralPath "$($m.paths.windows).drenv-source\owner.json" -Raw | ConvertFrom-Json
    if($owner.environmentId -cne $m.id -or $owner.ownerToken -cne $m.ownerToken -or $owner.path -cne $m.paths.windows){throw 'Foreign source claim'}
    Save $state
    Add-Type -Path (Join-Path $PSScriptRoot 'OwnedJob.cs')
    $job=[DrenvOwnedJob]::new("Local\drenv-$($m.ownerToken)-$($request.runId)")
    if($request.mode -eq 'build') {
        foreach($command in $request.commands) {
            $diagnostic='Build command '+$command.name+' failed to launch'
            $child=$job.Spawn($command.executable,$command.arguments,$m.paths.windows)
            $process=Get-Process -Id $child -ErrorAction SilentlyContinue
            $state.children=@(@{pid=$child; executable=$command.executable})
            Save $state
            $exitCode=$job.Wait($child)
            if($exitCode -ne 0){$diagnostic='Build command '+$command.name+' exited '+$exitCode;throw 'Build command failed'}
        }
        $head=(& git -C $m.paths.windows rev-parse HEAD) -join ''
        if($LASTEXITCODE -ne 0 -or $head -cne $m.revision){throw 'Source changed during build'}
        $state.status='built'
    } elseif($request.mode -in @('runtime','maintenance')) {
        $secret=Get-Content -LiteralPath (Join-Path $m.paths.runtime 'azurite-secret.json') -Raw | ConvertFrom-Json
        $env:AZURITE_ACCOUNTS="$($secret.account):$($secret.key)"
        $env:TEMP=Join-Path $m.paths.runtime 'temp'; $env:TMP=$env:TEMP
        $azurite=$job.Spawn($request.node,(Quote $request.azurite)+' --silent --location '+(Quote (Join-Path $m.paths.runtime 'blobs'))+" --blobHost 127.0.0.1 --queueHost 127.0.0.1 --tableHost 127.0.0.1 --blobPort $($m.ports.blob) --queuePort $($m.ports.queue) --tablePort $($m.ports.table)",$m.paths.runtime)
        Remove-Item Env:AZURITE_ACCOUNTS
        $configName=if($request.mode -eq 'maintenance'){'iis\maintenance.config'}else{'iis\applicationhost.config'}
        $iis=$job.Spawn($request.iis,'/config:'+(Quote (Join-Path $m.paths.runtime $configName))+' /site:DevResults',$m.paths.runtime)
        $state.children=@($azurite,$iis | ForEach-Object {$p=Get-Process -Id $_; @{pid=$p.Id; processStartTime=$p.StartTime.ToUniversalTime().ToString('o'); executable=$p.Path}})
        $ready=$false
        for($attempt=0;$attempt -lt 60;$attempt++) {
            foreach($child in $state.children){if(-not $job.IsAlive([int]$child.pid)){throw 'Owned child exited during startup'}}
            $ports=@($m.ports.http,$m.ports.https,$m.ports.blob,$m.ports.queue,$m.ports.table)
            $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in $ports})
            $azureListeners=@($listeners | Where-Object {$_.LocalPort -in @($m.ports.blob,$m.ports.queue,$m.ports.table) -and $_.OwningProcess -eq $azurite})
            # HTTP.sys owns IIS listeners as PID 4; IIS identity is verified separately through this job.
            if(@($listeners.LocalPort | Select-Object -Unique).Count -eq 5 -and @($azureListeners.LocalPort | Select-Object -Unique).Count -eq 3){$ready=$true;break}
            Start-Sleep -Milliseconds 500
        }
        if(-not $ready){throw 'Owned listeners did not become ready'}
        if($request.mode -eq 'maintenance') {
            . ([ScriptBlock]::Create($request.refresh))
            Invoke-OwnedRefreshTask $m $job $request
            $state.status='refreshed'
        } else {
        $healthy=$false
        for($attempt=0;$attempt -lt 30;$attempt++) {
            $response=$null
            try {
                $webRequest=[Net.HttpWebRequest]::Create("https://$($m.data.instance).devlocal.us:$($m.ports.https)/")
                $webRequest.AllowAutoRedirect=$false;$webRequest.Timeout=5000
                try{$response=$webRequest.GetResponse()}catch [Net.WebException]{$response=$_.Exception.Response}
                if($null -ne $response) {
                    $code=[int]$response.StatusCode
                    $diagnostic='Owned application returned HTTP '+$code
                    if($code -ge 200 -and $code -lt 400 -and $response.Headers['X-Drenv-Environment'] -ceq $m.id -and $response.Headers['X-Drenv-Revision'] -ceq $m.revision){$healthy=$true;break}
                }else{$diagnostic='Owned application request failed; check local DNS, TLS trust and IIS application dependencies'}
            } finally {if($null -ne $response){$response.Close()}}
            Start-Sleep -Milliseconds 500
        }
        if(-not $healthy){throw 'Application readiness failed'}
        $state.status='running';$state.applicationVerifiedAt=[datetime]::UtcNow.ToString('o'); Save $state
        while($true) {
            if(Test-Path -LiteralPath $request.stop){$stop=Get-Content -LiteralPath $request.stop -Raw | ConvertFrom-Json; if($stop.ownerToken -ceq $m.ownerToken -and $stop.runId -ceq $request.runId){break}}
            foreach($child in $state.children){if(-not $job.IsAlive([int]$child.pid)){throw 'Owned runtime child exited'}}
            Start-Sleep -Milliseconds 300
        }
        $state.status='stopped'
        }
    } else { throw 'Unknown supervisor mode' }
} catch {$state.status='failed';$state.failure=$diagnostic+'. Child trees are stopped.'}
finally {if($null -ne $job){$job.Dispose()};Save $state}
