$ErrorActionPreference='Stop'
$root=Join-Path $env:TEMP ('drenv-refresh-tests-'+[guid]::NewGuid().ToString('N'))
$passed=0
try {
    $m=[pscustomobject]@{catalog='drenv_refresh_test';paths=[pscustomobject]@{runtime=$root};ports=[pscustomobject]@{blob=28101;queue=28102;table=28103}}
    [void][IO.Directory]::CreateDirectory((Join-Path $root 'web\Core\Db'))
    Copy-Item 'C:\Code\DevResults\DevResults\Web.config' (Join-Path $root 'web\Web.config')
    New-OwnedApplicationConfig $m
    Assert-RefreshConfiguration $m;$passed++
    $path=Join-Path $root 'web\Core\Db\Connections.config'
    $original=[IO.File]::ReadAllText($path)
    foreach($connection in @('Server=.;Integrated Security=true;Initial Catalog=dev','Server=foreign;Integrated Security=true;Initial Catalog=drenv_refresh_test')) {
        [xml]$config=$original;$config.SelectSingleNode('/connectionStrings/add[@name="Main"]').SetAttribute('connectionString',$connection);$config.Save($path)
        $refused=$false;try{Assert-RefreshConfiguration $m}catch{$refused=$_.Exception.Message -like '*owned local catalog*'}
        if(-not $refused){throw 'Foreign SQL configuration accepted'};$passed++
    }
    [IO.File]::WriteAllText($path,$original)
    [xml]$config=$original;$node=$config.CreateElement('add');$node.SetAttribute('name','Other');$node.SetAttribute('connectionString','Server=foreign');[void]$config.DocumentElement.AppendChild($node);$config.Save($path)
    $refused=$false;try{Assert-RefreshConfiguration $m}catch{$refused=$_.Exception.Message -like '*additional database*'}
    if(-not $refused){throw 'Additional connection accepted'};$passed++
    [IO.File]::WriteAllText($path,$original)
    [xml]$config=$original;$config.SelectSingleNode('/connectionStrings/add[@name="AzureBlobStorage"]').SetAttribute('connectionString','UseDevelopmentStorage=true');$config.Save($path)
    $refused=$false;try{Assert-RefreshConfiguration $m}catch{$refused=$_.Exception.Message -like '*owned loopback account*'}
    if(-not $refused){throw 'Shared storage shortcut accepted'};$passed++
    [IO.File]::WriteAllText($path,$original)
    $webPath=Join-Path $root 'web\Web.config';$webOriginal=[IO.File]::ReadAllText($webPath)
    [xml]$web=$webOriginal;$web.SelectSingleNode('/configuration/system.net/mailSettings/smtp').SetAttribute('deliveryMethod','Network');$web.Save($webPath)
    $refused=$false;try{Assert-RefreshConfiguration $m}catch{$refused=$_.Exception.Message -like '*owned mail pickup*'}
    if(-not $refused){throw 'Network mail accepted'};$passed++
    [IO.File]::WriteAllText($webPath,$webOriginal)
    $settingsPath=Join-Path $root 'web\SecureSettings.config'
    [xml]$settings=[IO.File]::ReadAllText($settingsPath);Set-AppSetting $settings 'AutoDbRefresh.Enabled' 'true';$settings.Save($settingsPath)
    $refused=$false;try{Assert-RefreshConfiguration $m}catch{$refused=$_.Exception.Message -like '*AutoDbRefresh.Enabled*'}
    if(-not $refused){throw 'Automatic refresh was accepted'};$passed++
    foreach($case in @('success','task-failed','async-rollback','async-timeout')) {
        & {
            function Quote([string]$value){return '"'+$value+'"'}
            function Start-Sleep {}
            function Invoke-MaintenanceSql($Manifest,[string]$Query) {
                $rows=@()
                if($Query -like '*MAX(EventID)*'){$rows=@(@{EventID=1})}
                elseif($Query -like '*MAX(ScheduledTaskLogID)*'){$rows=@(@{TaskID=1})}
                elseif($Query -like '*SELECT Success*') {if($case -ne 'task-failed'){$rows=@(@{Success=$true})}}
                elseif($Query -like '*SELECT Category*'){$rows=@(@{Category='DbRefresh: 11111111-1111-1111-1111-111111111111'})}
                elseif($Query -like '*SELECT EventID*'){if($case -ne 'async-timeout'){$rows=@(@{EventID=2})}}
                elseif($Query -like '*WITH(TABLOCKX)*'){$rows=@(@{_Value=$(if($case -eq 'async-rollback'){'old'}else{'new'})})}
                else{$rows=@(@{_Value='old'})}
                return [pscustomobject]@{Rows=$rows}
            }
            $job=New-Object PSObject
            $job|Add-Member ScriptMethod Spawn {return 1}
            $job|Add-Member ScriptMethod Wait {return 0}
            $state=@{children=@()}
            $request=@{state=(Join-Path $root 'state.json');runId='fixture';curl='unused'}
            $m|Add-Member NoteProperty data ([pscustomobject]@{instance='example'}) -Force
            $m.ports|Add-Member NoteProperty https 28104 -Force
            $failed=$false;try{Invoke-OwnedRefreshTask $m $job $request}catch{$failed=$true}
            if($failed -eq ($case -eq 'success')){throw ('Maintenance completion result differed for '+$case)}
        }
        $passed++
    }
    @{passed=$passed;scope='Read-only maintenance guards against generated temporary configuration; no application or SQL migration invoked'}|ConvertTo-Json -Compress
} finally {if(Test-Path $root){Remove-Item -LiteralPath $root -Recurse -Force}}
