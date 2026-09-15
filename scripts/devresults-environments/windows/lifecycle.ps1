param($Request)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest

function Quote-Argument([string]$Value) { if($Value.Contains('"') -or $Value -match '[\r\n]'){Deny 'Unsupported process argument'};return '"'+$Value+'"' }
function Get-Control($Manifest) { return "$($Manifest.paths.windows).drenv-source\runner" }
function Get-State($Manifest) {
    $path=Join-Path (Get-Control $Manifest) 'state.json'
    if(-not(Test-Path -LiteralPath $path)){return $null}
    $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $reader=[IO.StreamReader]::new($stream)
    try{$state=$reader.ReadToEnd() | ConvertFrom-Json}finally{$reader.Dispose();$stream.Dispose()}
    Assert-Owner $state $Manifest
    return $state
}
function Test-Supervisor($State) {
    if($null -eq $State -or [int]$State.pid -le 0){return $false}
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$State.pid)"
    if($null -eq $process){return $false}
    $live=Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
    if($null -eq $live){return $false}
    $start=$live.StartTime.ToUniversalTime().ToString('o')
    if($start -cne $State.processStartTime -or -not $process.CommandLine -or $process.CommandLine.IndexOf($State.request,[StringComparison]::OrdinalIgnoreCase) -lt 0){if($State.status -in @('stopped','built','failed')){return $false};Deny 'Recorded supervisor PID has been reused or no longer matches its request; no process was killed.'}
    return $true
}
function Assert-Catalog($Manifest) {
    $exists=Invoke-Sql "SELECT name FROM sys.databases WHERE name=$(Sql-Literal $Manifest.catalog)"
    if($exists.Rows.Count -eq 0){return $false}
    $properties=Invoke-Sql "SELECT name,CONVERT(nvarchar(4000),value) AS value FROM sys.extended_properties WHERE class=0 AND name IN ('drenv.environmentId','drenv.ownerToken')" $Manifest.catalog
    $files=Invoke-Sql 'SELECT physical_name FROM sys.database_files' $Manifest.catalog
    Assert-CatalogMetadata $properties.Rows $files.Rows $Manifest
    return $true
}
function Assert-Runtime($Manifest) {
    $owner=Get-Json (Join-Path $Manifest.paths.runtime 'owner.json');Assert-Owner $owner $Manifest
    Assert-NoReparse $Manifest.paths.runtime
    $root=Split-Path -Parent (Split-Path -Parent $Manifest.paths.runtime)
    $claim=Get-Json (Join-Path $root "claims\$($Manifest.id).json");Assert-Owner $claim $Manifest
    if($claim.runtime -cne $Manifest.paths.runtime -or $claim.catalog -cne $Manifest.catalog -or (@($claim.ports)-join ',') -cne (@($Manifest.ports.https,$Manifest.ports.http,$Manifest.ports.blob,$Manifest.ports.queue,$Manifest.ports.table)-join ',')){Deny 'Runtime claim differs from manifest'}
}
function Get-OwnedTask($Manifest,$State) {
    $task=Get-ScheduledTask -TaskName "drenv-$($Manifest.id)-$($Manifest.ownerToken)" -ErrorAction SilentlyContinue
    if($null -eq $task){return $null}
    if($null -eq $State){Deny 'Scheduled task has no owned supervisor receipt'}
    $directory=Split-Path -Parent $State.request
    $expected='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File '+(Quote-Argument (Join-Path $directory 'supervisor.ps1'))+' -RequestPath '+(Quote-Argument $State.request)
    $executable=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    if(@($task.Actions).Count -ne 1 -or $task.Actions[0].Execute -ine $executable -or $task.Actions[0].Arguments -cne $expected -or $task.Actions[0].WorkingDirectory -ine $directory -or @($task.Triggers | Where-Object {$null -ne $_}).Count -ne 0){Deny 'Scheduled task action differs from the exact owned supervisor request'}
    return $task
}
function Assert-SupervisorIdle($Manifest,$State) {
    $task=Get-OwnedTask $Manifest $State
    if(($null -ne $State -and $State.status -in @('queued','starting','running')) -or ($null -ne $task -and $task.State -in @('Queued','Running'))){Deny 'An owned task is queued/running or its launch is ambiguous; inspect the exact task and supervisor receipt before retry.'}
}
function Stop-OwnedSupervisor($Manifest) {
    $state=Get-State $Manifest
    [void](Get-OwnedTask $Manifest $state)
    if(Test-Supervisor $state) {
        if($state.mode -ne 'runtime'){Deny 'An owned build is still active; wait for it to complete before changing the environment.'}
        Write-JsonAtomic (Join-Path (Split-Path -Parent $state.request) 'stop.json') @{ownerToken=$Manifest.ownerToken;runId=$state.runId}
        $stopped=$false
        for($attempt=0;$attempt -lt 100;$attempt++) {if(-not(Test-Supervisor $state)){$stopped=$true;break};Start-Sleep -Milliseconds 300}
        if(-not $stopped){Deny 'Owned supervisor did not stop within 30 seconds; inspect its exact task and receipt. No global process kill was attempted.'}
    }
    Assert-SupervisorIdle $Manifest (Get-State $Manifest)
    Assert-NotInUse $Manifest
    $ports=@($Manifest.ports.http,$Manifest.ports.https,$Manifest.ports.blob,$Manifest.ports.queue,$Manifest.ports.table)
    if(@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in $ports}).Count){Deny 'Reserved ports still have listeners after owned stop; inspect actual ownership before continuing.'}
}
function Ensure-Azurite([string]$HostRoot) {
    $directory=Join-Path $HostRoot 'tools\azurite-3.37.0'
    Assert-NoReparse $directory $false
    $marker=Join-Path $directory 'drenv-tool.json'
    if(Test-Path -LiteralPath $directory){$owner=Get-Json $marker;if($owner.kind -cne 'drenv-azurite' -or $owner.version -cne '3.37.0'){Deny 'Personal Azurite directory is foreign'}}
    else{[void][IO.Directory]::CreateDirectory((Split-Path -Parent $directory));[void](New-Item -ItemType Directory -Path $directory);Write-JsonAtomic $marker @{kind='drenv-azurite';version='3.37.0'}}
    $package=Join-Path $directory 'node_modules\azurite\package.json'
    $entry=Join-Path $directory 'node_modules\azurite\dist\src\azurite.js'
    if(-not(Test-Path -LiteralPath $entry)) {
        $npm=Get-Command npm.cmd -ErrorAction Stop
        $old=$ErrorActionPreference;$ErrorActionPreference='Continue'
        try{& $npm.Source install --prefix $directory --ignore-scripts --no-audit --no-fund --save-exact azurite@3.37.0 *> $null;$code=$LASTEXITCODE}finally{$ErrorActionPreference=$old}
        if($code -ne 0){Deny 'Could not install owned Azurite 3.37.0; check npm connectivity and disk capacity.'}
    }
    if((Get-Json $package).version -cne '3.37.0' -or -not(Test-Path -LiteralPath $entry)){Deny 'Owned Azurite install is incomplete'}
    return $entry
}
function Start-OwnedSupervisor($Manifest,[string]$Mode,$Assets,$Commands=$null) {
    $state=Get-State $Manifest
    if(Test-Supervisor $state){Deny 'An owned supervisor is already active'}
    Assert-NotInUse $Manifest
    $control=Get-Control $Manifest
    [void][IO.Directory]::CreateDirectory($control)
    $runId=[guid]::NewGuid().ToString('N')
    $directory=Join-Path $control $runId
    [void](New-Item -ItemType Directory -Path $directory)
    [IO.File]::WriteAllText((Join-Path $directory 'supervisor.ps1'),$Assets.supervisor)
    [IO.File]::WriteAllText((Join-Path $directory 'OwnedJob.cs'),$Assets.job)
    $taskName="drenv-$($Manifest.id)-$($Manifest.ownerToken)"
    $requestPath=Join-Path $directory 'request.json'
    $task=Get-OwnedTask $Manifest $state
    if($null -ne $task) {
        for($attempt=0;$attempt -lt 30 -and $task.State -eq 'Running' -and -not(Test-Supervisor $state);$attempt++){Start-Sleep -Milliseconds 100;$task=Get-ScheduledTask -TaskName $taskName}
        Assert-SupervisorIdle $Manifest $state
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    $request=@{manifest=$Manifest;mode=$Mode;runId=$runId;state=(Join-Path $control 'state.json');stop=(Join-Path $directory 'stop.json');commands=$Commands}
    if($Mode -eq 'runtime') {
        $request.node=(Get-Command node.exe).Source
        $request.azurite=Ensure-Azurite (Split-Path -Parent (Split-Path -Parent $Manifest.paths.runtime))
        $request.iis='C:\Program Files\IIS Express\iisexpress.exe'
        if(-not(Test-Path -LiteralPath $request.iis)){Deny 'IIS Express is missing'}
    }
    Write-JsonAtomic $requestPath $request
    # Save the exact task action before registration so a crash can be retried without adopting a task.
    Write-JsonAtomic (Join-Path $control 'state.json') @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken;revision=$Manifest.revision;runId=$runId;mode=$Mode;status='queued';pid=0;processStartTime='';request=$requestPath;children=@()}
    $executable=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $action=New-ScheduledTaskAction -Execute $executable -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File '+(Quote-Argument (Join-Path $directory 'supervisor.ps1'))+' -RequestPath '+(Quote-Argument $requestPath)) -WorkingDirectory $directory
    $principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType S4U -RunLevel Highest
    $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Settings $settings | Out-Null
    Start-ScheduledTask -TaskName $taskName
    $limit=if($Mode -eq 'build'){7200}else{120}
    for($attempt=0;$attempt -lt $limit;$attempt++) {
        $current=Get-State $Manifest
        if($current.runId -cne $runId){Deny 'Supervisor run identity changed'}
        if($current.status -eq 'failed'){Deny ('Owned supervisor failed: '+$current.failure)}
        if($Mode -eq 'runtime' -and $current.status -eq 'running' -and (Test-Supervisor $current)){return $current}
        if($Mode -eq 'build' -and $current.status -eq 'built' -and -not(Test-Supervisor $current)){return $current}
        Start-Sleep -Milliseconds 500
    }
    Deny 'Supervisor did not reach the requested state; Windows Task Scheduler logon rights or dependency inspection may be required. Its task and receipt were preserved.'
}
function Get-BuildArtifacts($Manifest,[string]$Root) {
    foreach($relative in @('bin\DevResults.dll','bin\DevResults.Core.dll','bin\DevResults.Api.dll','Web\dist\.vite\manifest.json')){if(-not(Test-Path -LiteralPath (Join-Path $Root $relative))){Deny "Build output is missing: $relative"}}
    $result=@()
    $files=@(Get-ChildItem -LiteralPath (Join-Path $Root 'bin'),(Join-Path $Root 'Web\dist') -File -Recurse -Force | Where-Object {$_.Name -cne 'Drenv.SchemaProbe.dll'} | Sort-Object FullName)
    foreach($file in $files){if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){Deny 'Build artifacts contain a reparse point'};$result+=@{path=$file.FullName.Substring($Root.Length+1);sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}
    return ,$result
}
function Build-OwnedSource($Manifest,$Assets) {
    Stop-OwnedSupervisor $Manifest
    Assert-OwnedSource $Manifest
    $control=Get-Control $Manifest;[void][IO.Directory]::CreateDirectory($control)
    $envFile=Join-Path $control 'build.env'
    $sourceEnv='C:\Code\DevResults\.env.local'
    if(-not(Test-Path -LiteralPath $sourceEnv)){Deny 'Primary build tool paths in .env.local are required'}
    $lines=@(Get-Content -LiteralPath $sourceEnv | Where-Object {$_ -match '^(MSBUILD|VSTEST)='})
    if($lines.Count -ne 2){Deny 'MSBUILD and VSTEST tool paths are required for the existing just recipes'}
    [IO.File]::WriteAllLines($envFile,$lines)
    $pwsh=(Get-Command pwsh.exe).Source
    $commands=@()
    foreach($step in @('nuget','packages','msbuild-app','build-client')) {
        $text=if($step -eq 'packages'){'& pnpm install --frozen-lockfile; exit $LASTEXITCODE'}else{'& just --dotenv-path '+(Quote-Argument $envFile)+' '+$step+'; exit $LASTEXITCODE'}
        $commands+=@{name=$step;executable=$pwsh;arguments='-NoProfile -NonInteractive -EncodedCommand '+[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($text))}
    }
    $completed=Start-OwnedSupervisor $Manifest 'build' $Assets $commands
    Assert-OwnedSource $Manifest
    Write-JsonAtomic (Join-Path $control 'build.json') @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken;revision=$Manifest.revision;completedAt=[datetime]::UtcNow.ToString('o');runId=$completed.runId;artifacts=(Get-BuildArtifacts $Manifest (Join-Path $Manifest.paths.windows 'DevResults'))}
}
function Assert-Build($Manifest,[string]$Deployment) {
    $receipt=Get-Json (Join-Path (Get-Control $Manifest) 'build.json');Assert-Owner $receipt $Manifest
    if($receipt.revision -cne $Manifest.revision){Deny 'Build receipt is stale for this source revision'}
    $actual=Get-BuildArtifacts $Manifest $Deployment
    if($actual.Count -ne @($receipt.artifacts).Count){Deny 'Build or deployment artifact set changed after the verified build'}
    foreach($artifact in $actual){$recorded=@($receipt.artifacts | Where-Object {$_.path -ceq $artifact.path});if($recorded.Count -ne 1 -or $recorded[0].sha256 -cne $artifact.sha256){Deny 'Build or deployment artifacts changed after the verified build'}}
}
function Test-OwnedSchema($Manifest,$Assets) {
    Assert-Runtime $Manifest
    Stop-OwnedSupervisor $Manifest
    Assert-OwnedSource $Manifest
    if(-not(Assert-Catalog $Manifest)){Deny 'Owned restored catalog is missing'}
    $web=Join-Path $Manifest.paths.runtime 'web'
    $deployment=Get-Json (Join-Path $web '.drenv-deployment.json');Assert-Owner $deployment $Manifest
    if($deployment.state -cne 'ready' -or $deployment.revision -cne $Manifest.revision){Deny 'Owned deployment is incomplete or stale'}
    Assert-Build $Manifest $web
    [xml]$settings=[IO.File]::ReadAllText((Join-Path $web 'SecureSettings.config'))
    if($settings.SelectSingleNode('/appSettings/add[@key="AutoDbRefresh.Enabled"]').GetAttribute('value') -cne 'false'){Deny 'Automatic database refresh must stay disabled'}
    [xml]$webConfig=[IO.File]::ReadAllText((Join-Path $web 'Web.config'))
    $server=$webConfig.SelectSingleNode('/configuration/system.webServer')
    $protocol=$server.SelectSingleNode('httpProtocol')
    if($null -eq $protocol){$protocol=$webConfig.CreateElement('httpProtocol');[void]$server.AppendChild($protocol)}
    $headers=$protocol.SelectSingleNode('customHeaders')
    if($null -eq $headers){$headers=$webConfig.CreateElement('customHeaders');[void]$protocol.AppendChild($headers)}
    foreach($pair in @(@('X-Drenv-Environment',$Manifest.id),@('X-Drenv-Revision',$Manifest.revision))){foreach($old in @($headers.SelectNodes('add') | Where-Object {$_.GetAttribute('name') -ceq $pair[0]})){[void]$headers.RemoveChild($old)};$node=$webConfig.CreateElement('add');$node.SetAttribute('name',$pair[0]);$node.SetAttribute('value',$pair[1]);[void]$headers.AppendChild($node)}
    $webConfig.Save((Join-Path $web 'Web.config'))
    $bin=Join-Path $web 'bin'
    $assembly=Join-Path $bin 'Drenv.SchemaProbe.dll'
    $probeMarker=Join-Path $Manifest.paths.runtime 'schema-probe.json'
    if(Test-Path -LiteralPath $assembly){$previous=Get-Json $probeMarker;Assert-Owner $previous $Manifest;if((Get-FileHash -LiteralPath $assembly -Algorithm SHA256).Hash -cne $previous.sha256){Deny 'Existing schema probe assembly is foreign or changed'};Remove-Item -LiteralPath $assembly}
    Add-Type -TypeDefinition $Assets.schema -ReferencedAssemblies @('System.Web.dll') -OutputAssembly $assembly
    Write-JsonAtomic $probeMarker @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken;sha256=(Get-FileHash -LiteralPath $assembly -Algorithm SHA256).Hash}
    Add-Type -AssemblyName System.Web
    $probeAssembly=[Reflection.Assembly]::LoadFrom($assembly)
    $probe=[Web.Hosting.ApplicationHost]::CreateApplicationHost($probeAssembly.GetType('DrenvSchemaProbe'),'/',$web)
    try{$computed=$probe.Compute()}finally{$probe.Shutdown()}
    $table=Invoke-Sql "SELECT _Value FROM dbo._Global WHERE _Key=N'SchemaHash'" $Manifest.catalog
    if($computed -cnotmatch '^[a-f0-9]{64}$' -or $table.Rows.Count -ne 1 -or $table.Rows[0]._Value -cne $computed){Deny 'Built application schema differs from restored SQL; no runtime was started and no database was upgraded.'}
    Write-JsonAtomic (Join-Path $Manifest.paths.runtime 'schema.json') @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken;revision=$Manifest.revision;schemaHash=$computed;snapshotRevision=(Get-Json (Join-Path $Manifest.paths.runtime 'provision-journal.json')).snapshot.revision;verifiedAt=[datetime]::UtcNow.ToString('o');artifacts=(Get-BuildArtifacts $Manifest $web)}
}
function Assert-NoDatabaseWriters($Manifest) {
    $sessions=Invoke-Sql "SELECT session_id FROM sys.dm_exec_sessions WHERE database_id=DB_ID($(Sql-Literal $Manifest.catalog)) AND session_id<>@@SPID" $Manifest.catalog
    if($sessions.Rows.Count -gt 0){Deny 'Other SQL sessions still use the owned catalog; coordinate those writers before snapshot/reset/remove.'}
}
function Recover-OwnedSnapshot($Manifest) {
    $path=Join-Path $Manifest.paths.runtime 'snapshot-state.json'
    if(-not(Test-Path -LiteralPath $path)){return}
    $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $reader=[IO.StreamReader]::new($stream)
    try{$state=$reader.ReadToEnd() | ConvertFrom-Json}finally{$reader.Dispose();$stream.Dispose()}
    Assert-Owner $state $Manifest
    if($state.phase -ne 'capturing'){return}
    $process=Get-Process -Id $state.pid -ErrorAction SilentlyContinue
    if($null -ne $process){Deny 'Recorded snapshot process is still alive or its PID was reused; recovery refused'}
    if(-not(Assert-Catalog $Manifest)){Deny 'Snapshot recovery requires the owned catalog'}
    [void](Invoke-Sql "ALTER DATABASE $(Sql-Identifier $Manifest.catalog) SET READ_WRITE WITH NO_WAIT")
    Write-JsonAtomic $path @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken;phase='recovered';snapshotRevision=$state.snapshotRevision;buildRevision=$Manifest.revision}
}
function Snapshot-OwnedData($Manifest) {
    Assert-Runtime $Manifest
    Stop-OwnedSupervisor $Manifest
    if(-not(Assert-Catalog $Manifest)){Deny 'Owned catalog is missing'}
    Assert-NoDatabaseWriters $Manifest
    Recover-OwnedSnapshot $Manifest
    $root=Split-Path -Parent (Split-Path -Parent $Manifest.paths.runtime)
    $directory=Join-Path $root "snapshots\$($Manifest.id)\$([guid]::NewGuid().ToString('N'))"
    [void][IO.Directory]::CreateDirectory($directory)
    Write-JsonAtomic (Join-Path $directory 'owner.json') @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken}
    $service=Get-CimInstance Win32_Service -Filter "Name='MSSQLSERVER'"
    & icacls $directory /grant "$($service.StartName):(OI)(CI)F" | Out-Null
    if($LASTEXITCODE -ne 0){Deny 'Could not grant snapshot directory access to SQL Server'}
    $catalog=Sql-Identifier $Manifest.catalog
    $backup=Join-Path $directory 'database.bak'
    $blobs=Join-Path $directory 'blobs'
    $started=[datetime]::UtcNow.ToString('o')
    $readOnly=$false
    $snapshotState=Join-Path $Manifest.paths.runtime 'snapshot-state.json'
    Write-JsonAtomic $snapshotState @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken;phase='capturing';pid=$PID;processStartTime=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o');snapshotRevision=$Manifest.revision;buildRevision=$Manifest.revision;path=$directory}
    try {
        [void](Invoke-Sql "ALTER DATABASE $catalog SET READ_ONLY WITH NO_WAIT")
        $readOnly=$true
        [void](Invoke-Sql "BACKUP DATABASE $catalog TO DISK=$(Sql-Literal $backup) WITH COPY_ONLY,CHECKSUM")
        [void][IO.Directory]::CreateDirectory($blobs)
        Get-ChildItem -LiteralPath (Join-Path $Manifest.paths.runtime 'blobs') -Force | Copy-Item -Destination $blobs -Recurse -Force
        $digest=Get-BlobDigest $blobs
        $files=Invoke-Sql "RESTORE FILELISTONLY FROM DISK=$(Sql-Literal $backup)"
        [long]$allocated=0;foreach($file in $files.Rows){$allocated+=[long]$file.Size}
        $schema=Invoke-Sql "SELECT _Value FROM dbo._Global WHERE _Key=N'SchemaHash'" $Manifest.catalog
        if($schema.Rows.Count -ne 1){Deny 'Owned catalog has no unique schema hash'}
        $receipt=@{version=1;sourceDatabase=$Manifest.catalog;sourceInstance=$Manifest.data.instance;revision=$Manifest.revision;schemaHash=[string]$schema.Rows[0]._Value;coordination=@{method='writers-paused';startedAt=$started;completedAt=[datetime]::UtcNow.ToString('o');evidence='Owned supervisor stopped, no other SQL sessions, owned catalog held read-only during SQL and blob capture'};sql=@{path=$backup;sha256=(Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash.ToLowerInvariant();allocatedBytes=$allocated};blobs=@{path=$blobs;sha256=$digest.sha256;bytes=$digest.bytes}}
        Write-JsonAtomic (Join-Path $directory 'snapshot.json') $receipt
        return $receipt
    } finally {if($readOnly){[void](Invoke-Sql "ALTER DATABASE $catalog SET READ_WRITE WITH NO_WAIT")};Write-JsonAtomic $snapshotState @{environmentId=$Manifest.id;ownerToken=$Manifest.ownerToken;phase='stopped';snapshotRevision=$Manifest.revision;buildRevision=$Manifest.revision;path=$directory}}
}
function Assert-RemovalPreflight($Manifest,[bool]$Complete) {
    $root=Split-Path -Parent (Split-Path -Parent $Manifest.paths.runtime)
    $runtimeExists=Test-Path -LiteralPath $Manifest.paths.runtime
    $catalogExists=Assert-Catalog $Manifest
    if($runtimeExists){Assert-Runtime $Manifest}
    elseif($catalogExists){Deny 'Catalog exists without the owned runtime directory; inspect interrupted removal'}
    if($catalogExists){Assert-NoDatabaseWriters $Manifest}
    foreach($name in @('sql','blobs','cache','temp','mail','output')){Assert-NoReparse (Join-Path $Manifest.paths.runtime $name)}
    if(-not $Complete){return}
    $binding=(& netsh http show sslcert "ipport=0.0.0.0:$($Manifest.ports.https)") -join "`n"
    if($LASTEXITCODE -eq 0){Assert-TlsBinding $Manifest}
    $claim=Join-Path $root "claims\$($Manifest.id).json"
    if(Test-Path -LiteralPath $claim){Assert-NoReparse $claim;Assert-Owner (Get-Json $claim) $Manifest}
    $state=Get-State $Manifest
    Assert-SupervisorIdle $Manifest $state
    $sourceClaim="$($Manifest.paths.windows).drenv-source"
    if(Test-Path -LiteralPath $sourceClaim){Assert-NoReparse $sourceClaim;Assert-Owner (Get-Json (Join-Path $sourceClaim 'owner.json')) $Manifest}
    if(Test-Path -LiteralPath $Manifest.paths.windows){
        Assert-NoReparse $Manifest.paths.windows $false
        Assert-OwnedSource $Manifest
        $dirty=(& git -C $Manifest.paths.windows status --porcelain --untracked-files=all) -join ''
        if($LASTEXITCODE -ne 0 -or $dirty){Deny 'Windows source has uncommitted work; preserve it before removal'}
    }
}
# Git for Windows can traverse junctions during forced worktree removal. Unlink them first.
function Remove-SourceLinks([string]$Root) {
    $pending=[Collections.Generic.Stack[string]]::new()
    $pending.Push($Root)
    while($pending.Count) {
        $directory=$pending.Pop()
        Assert-NoReparse $directory $false
        foreach($entry in @(Get-ChildItem -LiteralPath $directory -Force)) {
            if(($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                if(($entry.Attributes -band [IO.FileAttributes]::Directory) -ne 0){[IO.Directory]::Delete($entry.FullName,$false)}else{[IO.File]::Delete($entry.FullName)}
            } elseif(($entry.Attributes -band [IO.FileAttributes]::Directory) -ne 0){$pending.Push($entry.FullName)}
        }
    }
}
function Remove-OwnedData($Manifest,[bool]$Complete) {
    Stop-OwnedSupervisor $Manifest
    Assert-RemovalPreflight $Manifest $Complete
    $root=Split-Path -Parent (Split-Path -Parent $Manifest.paths.runtime)
    $runtimeExists=Test-Path -LiteralPath $Manifest.paths.runtime
    $catalogExists=Assert-Catalog $Manifest
    if($runtimeExists){Assert-Runtime $Manifest}
    elseif($catalogExists){Deny 'Catalog exists without the owned runtime directory; inspect interrupted removal'}
    if($catalogExists) {Assert-NoDatabaseWriters $Manifest;[void](Invoke-Sql "DROP DATABASE $(Sql-Identifier $Manifest.catalog)")}
    if($runtimeExists) {
        foreach($name in @('sql','blobs','cache','temp','mail','output')) {
            $path=Join-Path $Manifest.paths.runtime $name
            Assert-NoReparse $path
            if(Test-Path -LiteralPath $path){Get-ChildItem -LiteralPath $path -Force | Remove-Item -Recurse -Force}
        }
        if($Complete) {
            $binding=(& netsh http show sslcert "ipport=0.0.0.0:$($Manifest.ports.https)") -join "`n"
            if($LASTEXITCODE -eq 0){Assert-TlsBinding $Manifest;& netsh http delete sslcert "ipport=0.0.0.0:$($Manifest.ports.https)" | Out-Null;if($LASTEXITCODE -ne 0){Deny 'Owned TLS binding removal failed'}}
            Remove-Item -LiteralPath $Manifest.paths.runtime -Recurse -Force
        }
    }
    if($Complete) {
        $claim=Join-Path $root "claims\$($Manifest.id).json"
        if(Test-Path -LiteralPath $claim){Assert-Owner (Get-Json $claim) $Manifest;Remove-Item -LiteralPath $claim}
        $state=Get-State $Manifest
        $taskName="drenv-$($Manifest.id)-$($Manifest.ownerToken)"
        $task=Get-OwnedTask $Manifest $state
        if($null -ne $task){Assert-SupervisorIdle $Manifest $state;Unregister-ScheduledTask -TaskName $taskName -Confirm:$false}
        $sourceClaim="$($Manifest.paths.windows).drenv-source"
        if(Test-Path -LiteralPath $Manifest.paths.windows) {
            Assert-OwnedSource $Manifest
            if((& git -C $Manifest.paths.windows status --porcelain --untracked-files=all) -join ''){Deny 'Windows source has uncommitted work; preserve it before removal'}
            Remove-SourceLinks $Manifest.paths.windows
            & git -C (Join-Path $sourceClaim 'repository.git') worktree remove --force -- $Manifest.paths.windows 2>$null
            if($LASTEXITCODE -ne 0){Deny 'Windows source has uncommitted/ignored work or removal failed; preserve it before removal'}
        }
        if(Test-Path -LiteralPath $sourceClaim){Assert-NoReparse $sourceClaim;Assert-Owner (Get-Json (Join-Path $sourceClaim 'owner.json')) $Manifest;Remove-Item -LiteralPath $sourceClaim -Recurse -Force}
    }
}

function Assert-EmptyReservation($Manifest) {
    $root=Split-Path -Parent (Split-Path -Parent $Manifest.paths.runtime)
    foreach($path in @($Manifest.paths.windows,"$($Manifest.paths.windows).drenv-source",$Manifest.paths.runtime,(Join-Path $root "claims\$($Manifest.id).json"))) {
        if(Test-Path -LiteralPath $path){Deny 'Resources exist without a verified source revision; preserve them and inspect interrupted pairing before removal.'}
    }
    $catalog=Invoke-Sql "SELECT name FROM sys.databases WHERE name=$(Sql-Literal $Manifest.catalog)"
    if($catalog.Rows.Count){Deny 'SQL catalog exists without a verified source revision; no data was removed.'}
    if($null -ne (Get-OwnedTask $Manifest $null)){Deny 'Scheduled task exists without a verified source revision.'}
    Assert-NotInUse $Manifest
    Assert-NoForeignPorts $Manifest @() $false
}

$lock=$null
$sourceLock=$null
$operationMutex=$null
$ownsMutex=$false
try {
    $m=$Request.manifest
    $revision=if($m.PSObject.Properties.Name -contains 'revision'){[string]$m.revision}else{''}
    if($m.id -cnotmatch '^[a-z][a-z0-9-]{0,39}$' -or $m.catalog -cnotmatch '^drenv_[a-z0-9_]+$' -or ($Request.operation -notin @('status','stop','recover','remove') -and $revision -cnotmatch '^[a-f0-9]{40}$') -or ($Request.operation -eq 'remove' -and $revision -and $revision -cnotmatch '^[a-f0-9]{40}$')){Deny 'Invalid lifecycle identity or revision'}
    [void][guid]::Parse($m.ownerToken)
    Assert-NativePath $m.paths.windows;Assert-NativePath $m.paths.runtime
    Assert-NoReparse $m.paths.windows $false;Assert-NoReparse "$($m.paths.windows).drenv-source" $false
    $root=Split-Path -Parent (Split-Path -Parent $m.paths.runtime)
    if($m.paths.runtime -cne (Join-Path $root "runtime\$($m.id)") -or $m.paths.windows -cne (Join-Path $root "source\$($m.id)")){Deny 'Lifecycle paths do not match the personal environment mapping'}
    $operationMutex=[Threading.Mutex]::new($false,"Global\drenv-lifecycle-$($m.ownerToken)")
    try{$ownsMutex=$operationMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$ownsMutex=$true}
    if(-not $ownsMutex){Deny 'A Windows lifecycle operation still owns this environment; wait for its receipt before retry'}
    if($Request.operation -eq 'remove' -and -not $revision) {
        if(Test-Path -LiteralPath $root){$lock=[IO.File]::Open((Join-Path $root 'provision.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
        Assert-EmptyReservation $m
        @{ok=$true;environmentId=$m.id;ownerToken=$m.ownerToken;status='removed'} | ConvertTo-Json -Compress
        return
    }
    if($Request.operation -notin @('status','stop','build','schema')){$lock=[IO.File]::Open((Join-Path $root 'provision.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
    $result=@{ok=$true;environmentId=$m.id;ownerToken=$m.ownerToken;status='stopped'}
    switch($Request.operation) {
        'status' {$state=Get-State $m;if(Test-Supervisor $state){$result.status=$state.status}else{Assert-SupervisorIdle $m $state;$result.status='stopped'};$result.supervisor=$state}
        'stop' {Stop-OwnedSupervisor $m}
        'build' {Build-OwnedSource $m $Request.assets;$result.status='built'}
        'schema' {Test-OwnedSchema $m $Request.assets;$result.status='schema-verified'}
        'start' {
            $state=Get-State $m
            if((Test-Supervisor $state) -and $state.mode -eq 'runtime' -and $state.status -eq 'running'){$result.status='running';break}
            Test-OwnedSchema $m $Request.assets
            Assert-TlsBinding $m
            $claims=@(Get-ChildItem -LiteralPath (Join-Path $root 'claims') -Filter '*.json' | ForEach-Object {Get-Json $_.FullName})
            Assert-NoForeignPorts $m $claims $true
            $started=Start-OwnedSupervisor $m 'runtime' $Request.assets
            $result.status=$started.status
        }
        'snapshot' {$result.snapshot=Snapshot-OwnedData $m}
        'recover' {
            $sourceClaim="$($m.paths.windows).drenv-source"
            if(Test-Path -LiteralPath $sourceClaim){Assert-Owner (Get-Json (Join-Path $sourceClaim 'owner.json')) $m;$sourceLock=[IO.File]::Open((Join-Path $sourceClaim 'operation.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}
            Stop-OwnedSupervisor $m
            if(Test-Path -LiteralPath $m.paths.runtime){Assert-Runtime $m;[void](Assert-Catalog $m);Recover-OwnedSnapshot $m}
            $result.status='recovered'
        }
        'reset' {Remove-OwnedData $m $false}
        'remove' {Remove-OwnedData $m $true;$result.status='removed'}
        default {Deny 'Unknown lifecycle operation'}
    }
    $result | ConvertTo-Json -Compress -Depth 30
} catch {
    $message='Windows lifecycle failed; inspect owned receipts and host prerequisites. Raw diagnostics withheld.'
    if($_.Exception.Message.StartsWith('DRENV: ')){$message=$_.Exception.Message.Substring(7)}
    @{ok=$false;prerequisite=$message} | ConvertTo-Json -Compress
} finally {if($null -ne $sourceLock){$sourceLock.Dispose()};if($null -ne $lock){$lock.Dispose()};if($ownsMutex){$operationMutex.ReleaseMutex()};if($null -ne $operationMutex){$operationMutex.Dispose()}}
