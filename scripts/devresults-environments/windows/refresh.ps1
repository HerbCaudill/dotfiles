# Explicit maintenance uses only the verified owned deployment and Windows-local HTTP.
function Assert-RefreshConfiguration($Manifest) {
    $web=Join-Path $Manifest.paths.runtime 'web'
    Assert-NoReparse $web
    [xml]$config=[IO.File]::ReadAllText((Join-Path $web 'Web.config'))
    if($config.configuration.connectionStrings.configSource -ine 'Core\Db\Connections.config' -or $config.configuration.appSettings.file -cne 'SecureSettings.config'){Deny 'Refresh requires the generated owned configuration sources'}
    if(@($config.SelectNodes('/configuration/connectionStrings/add')).Count -or @($config.SelectNodes('/configuration/location/connectionStrings | /configuration/location/appSettings')).Count){Deny 'Refresh refuses inline connection or location overrides'}
    [xml]$connections=[IO.File]::ReadAllText((Join-Path $web 'Core\Db\Connections.config'))
    $entries=@($connections.SelectNodes('/connectionStrings/add'))
    if($entries.Count -ne 2 -or @($entries|Where-Object {$_.name -notin @('Main','AzureBlobStorage')}).Count){Deny 'Refresh refuses additional database connections'}
    $main=@($entries|Where-Object {$_.name -ceq 'Main'})
    $azure=@($entries|Where-Object {$_.name -ceq 'AzureBlobStorage'})
    if($main.Count -ne 1 -or $azure.Count -ne 1){Deny 'Refresh requires unique owned connections'}
    $sql=[Data.SqlClient.SqlConnectionStringBuilder]::new([string]$main[0].connectionString)
    if($sql.DataSource -cne '.' -or $sql.InitialCatalog -cne $Manifest.catalog -or -not $sql.IntegratedSecurity -or $sql.AttachDBFilename -or $sql.FailoverPartner){Deny 'Refresh SQL connection does not target the owned local catalog'}
    $secret=Get-Json (Join-Path $Manifest.paths.runtime 'azurite-secret.json')
    $expected="DefaultEndpointsProtocol=http;AccountName=$($secret.account);AccountKey=$($secret.key);BlobEndpoint=http://127.0.0.1:$($Manifest.ports.blob)/$($secret.account);QueueEndpoint=http://127.0.0.1:$($Manifest.ports.queue)/$($secret.account);TableEndpoint=http://127.0.0.1:$($Manifest.ports.table)/$($secret.account)"
    if($azure[0].connectionString -cne $expected){Deny 'Refresh storage connection does not target the owned loopback account'}
    [xml]$settings=[IO.File]::ReadAllText((Join-Path $web 'SecureSettings.config'))
    foreach($pair in @(@('AutoDbRefresh.Enabled','false'),@('AzureBlobStorageAccount',''),@('AppTempPath',(Join-Path $Manifest.paths.runtime 'temp')),@('DiskCachePath',(Join-Path $Manifest.paths.runtime 'cache')))) {
        $nodes=@($settings.SelectNodes('/appSettings/add')|Where-Object {$_.key -ceq $pair[0]})
        if($nodes.Count -ne 1 -or $nodes[0].value -cne $pair[1]){Deny ('Refresh requires owned setting '+$pair[0])}
    }
    $smtp=$config.SelectSingleNode('/configuration/system.net/mailSettings/smtp')
    if($null -eq $smtp -or $smtp.deliveryMethod -cne 'SpecifiedPickupDirectory' -or $smtp.specifiedPickupDirectory.pickupDirectoryLocation -cne (Join-Path $Manifest.paths.runtime 'mail')){Deny 'Refresh requires the owned mail pickup directory'}
}
function Refresh-OwnedDatabase($Manifest,$Assets) {
    Stop-OwnedSupervisor $Manifest
    Assert-Runtime $Manifest
    Assert-OwnedSource $Manifest
    if(-not(Assert-Catalog $Manifest)){Deny 'Refresh requires an owned restored catalog'}
    Assert-NoDatabaseWriters $Manifest
    $web=Join-Path $Manifest.paths.runtime 'web'
    $deployment=Get-Json (Join-Path $web '.drenv-deployment.json');Assert-Owner $deployment $Manifest
    if($deployment.state -cne 'ready' -or $deployment.revision -cne $Manifest.revision){Deny 'Refresh deployment is incomplete or stale'}
    Assert-Build $Manifest $web
    Assert-RefreshConfiguration $Manifest
    Assert-TlsBinding $Manifest
    $config=Join-Path $Manifest.paths.runtime 'iis\maintenance.config'
    New-OwnedIisConfig (Join-Path $Manifest.paths.runtime 'iis\applicationhost.config') $config $Manifest
    [xml]$iis=[IO.File]::ReadAllText($config)
    foreach($binding in $iis.SelectNodes('/configuration/system.applicationHost/sites/site/bindings/binding')){$port=if($binding.protocol -eq 'https'){$Manifest.ports.https}else{$Manifest.ports.http};$binding.SetAttribute('bindingInformation',"127.0.0.1:${port}:")}
    $iis.Save($config)
    # Maintenance has its own bounded supervisor; an interrupted SSH client cannot release its children.
    try {[void](Start-OwnedSupervisor $Manifest 'maintenance' $Assets)}
    finally {Stop-OwnedSupervisor $Manifest}
    Test-OwnedSchema $Manifest $Assets
}
function Invoke-MaintenanceSql($Manifest,[string]$Query) {
    $connection=[Data.SqlClient.SqlConnection]::new("Server=.;Integrated Security=true;Initial Catalog=$($Manifest.catalog);Pooling=false")
    try{$connection.Open();$command=$connection.CreateCommand();$command.CommandTimeout=30;$command.CommandText=$Query;$table=[Data.DataTable]::new();$reader=$command.ExecuteReader();try{$table.Load($reader)}finally{$reader.Dispose()};return ,$table}finally{$connection.Dispose()}
}
function Invoke-OwnedRefreshTask($Manifest,$Job,$Request) {
    $before=Invoke-MaintenanceSql $Manifest 'SELECT ISNULL(MAX(EventID),0) AS EventID FROM dbo.Events'
    $eventId=[long]$before.Rows[0].EventID
    $asyncBefore=Invoke-MaintenanceSql $Manifest "SELECT _Value FROM dbo._Global WHERE _Key=N'AsyncDbRefresh'"
    $previousAsync=if($asyncBefore.Rows.Count){[string]$asyncBefore.Rows[0]._Value}else{''}
    $beforeTasks=Invoke-MaintenanceSql $Manifest 'SELECT ISNULL(MAX(ScheduledTaskLogID),0) AS TaskID FROM dbo.ScheduledTaskLogs'
    $taskId=[long]$beforeTasks.Rows[0].TaskID
    $hostName="$($Manifest.data.instance).devlocal.us"
    $output=Join-Path (Split-Path -Parent $Request.state) ("refresh-response-"+$Request.runId+'.txt')
    $script:diagnostic='Database refresh HTTP task failed; private response and supervisor receipt retained'
    $arguments='--silent --show-error --fail --noproxy "*" --max-time 1800 --resolve '+(Quote "${hostName}:$($Manifest.ports.https):127.0.0.1")+' --output '+(Quote $output)+' '+(Quote "https://${hostName}:$($Manifest.ports.https)/Task/RefreshDb/Null")
    $curl=$Job.Spawn($Request.curl,$arguments,$Manifest.paths.runtime)
    $exitCode=$Job.Wait($curl)
    if($exitCode -ne 0){throw ('Refresh request exit '+$exitCode)}
    $script:diagnostic='Database refresh HTTP response lacked a unique successful task/event receipt; inspect the owned task logs'
    $tasks=Invoke-MaintenanceSql $Manifest "SELECT Success FROM dbo.ScheduledTaskLogs WHERE ScheduledTaskLogID>$taskId AND TaskName=N'RefreshDb' AND Success=1"
    if($tasks.Rows.Count -ne 1){throw 'No unique successful refresh task receipt'}
    $runs=Invoke-MaintenanceSql $Manifest "SELECT Category FROM dbo.Events WHERE EventID>$eventId AND Category LIKE N'DbRefresh: %' AND Description LIKE N'Starting DbRefresh with SchemaHash: %'"
    if($runs.Rows.Count -ne 1){throw 'No unique refresh event identity'}
    $category=[string]$runs.Rows[0].Category
    if($category -cnotmatch '^DbRefresh: [a-fA-F0-9-]{36}$'){throw 'Invalid refresh event identity'}
    $script:diagnostic='Database refresh task completed, but asynchronous EnforceIndexes did not finish within 30 minutes; inspect owned Events and mail pickup'
    $deadline=[datetime]::UtcNow.AddMinutes(30)
    for($attempt=0;$attempt -lt 900 -and [datetime]::UtcNow -lt $deadline;$attempt++) {
        foreach($child in $state.children){if(-not $Job.IsAlive([int]$child.pid)){throw 'Maintenance child exited'}}
        $events=Invoke-MaintenanceSql $Manifest "SELECT EventID FROM dbo.Events WHERE EventID>$eventId AND Category=N'$category' AND Description LIKE N'EnforceIndexes completed.%'"
        if($events.Rows.Count -eq 1){
            # This row is changed inside the async index transaction. The lock waits for commit/rollback.
            $committed=Invoke-MaintenanceSql $Manifest "SELECT _Value FROM dbo._Global WITH(TABLOCKX) WHERE _Key=N'AsyncDbRefresh'"
            if($committed.Rows.Count -ne 1 -or [string]$committed.Rows[0]._Value -ceq $previousAsync){$script:diagnostic='Asynchronous refresh rolled back or has no committed index transaction';throw 'Index completion event did not have a committed async transaction'}
            return
        }
        Start-Sleep -Seconds 2
    }
    throw 'Asynchronous index timeout'
}
