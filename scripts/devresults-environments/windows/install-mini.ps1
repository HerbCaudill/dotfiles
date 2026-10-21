param([string]$RepoRoot='C:\Code\HerbCaudill\dotfiles',[switch]$Update)
$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ine 'MINI'){throw 'This host profile must be installed on mini'}
$name='drenv mini controller'
$existingTask=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if($existingTask -and -not $Update){throw 'Controller task already exists; use -Update after its requests complete'}
$root='C:\DevResultsEnvironments'
if(Test-Path $root){if(-not(Test-Path "$root\mini-host.json")){throw 'Refusing unowned mini environment root'};$owner=Get-Content "$root\mini-host.json" -Raw|ConvertFrom-Json;if($owner.kind -cne 'drenv-mini' -or $owner.version -ne 1){throw 'Foreign mini host marker'}}
else{New-Item -ItemType Directory $root|Out-Null;@{kind='drenv-mini';version=1}|ConvertTo-Json|Set-Content "$root\mini-host.json"}
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
# Herb submits requests without elevation. Other local users cannot write executable control inputs.
& icacls $root /inheritance:r /grant:r "${user}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' 'BUILTIN\Administrators:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Could not protect environment root'}
$pwsh='C:\Program Files\PowerShell\7\pwsh.exe'
$mise=(Get-Command mise.exe).Source
$controller=Join-Path $RepoRoot 'scripts\devresults-environments\nativeController.ts'
$launcher=Join-Path $root 'controller.ps1'
if($existingTask){
    if(@($existingTask.Actions).Count -ne 1 -or $existingTask.Actions[0].Execute -ine $pwsh -or $existingTask.Actions[0].Arguments -cne "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $launcher" -or $existingTask.Principal.RunLevel -ne 'Highest' -or $existingTask.Principal.LogonType -ne 'S4U'){throw 'Foreign controller task action or principal'}
    foreach($request in @(Get-ChildItem "$root\registry\requests" -Directory -ErrorAction SilentlyContinue)){
        if(Test-Path (Join-Path $request.FullName 'result.json')){continue}
        $worker=Join-Path $request.FullName 'worker.json'
        if(Test-Path $worker){$receipt=Get-Content $worker -Raw|ConvertFrom-Json;if(Get-Process -Id $receipt.pid -ErrorAction SilentlyContinue){throw 'An active controller worker prevents update'}}
    }
    Stop-ScheduledTask -TaskName $name
    for($i=0;$i -lt 50 -and (Get-ScheduledTask -TaskName $name).State -eq 'Running';$i++){Start-Sleep -Milliseconds 100}
    if((Get-ScheduledTask -TaskName $name).State -eq 'Running'){throw 'Controller did not stop; launcher preserved'}
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
}
@"
`$env:Path="`$env:USERPROFILE\AppData\Local\mise\shims;`$env:USERPROFILE\AppData\Local\mise\bin;"+[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
& '$mise' exec node@24 -- node --experimental-strip-types '$controller' *> '$root\controller.log'
exit `$LASTEXITCODE
"@|Set-Content $launcher
$action=New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $launcher" -WorkingDirectory $root
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Highest
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([timespan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $name -Action $action -Principal $principal -Settings $settings -Trigger (New-ScheduledTaskTrigger -AtStartup)|Out-Null
$bin=Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Force $bin|Out-Null
"@echo off`r`n`"$mise`" exec node@24 -- node --experimental-strip-types `"$RepoRoot\scripts\devresults-environments\drenv.ts`" %*"|Set-Content (Join-Path $bin 'drenv.cmd')
Start-ScheduledTask -TaskName $name
$tools=Join-Path $root 'tools\azurite-3.37.0'
if(Test-Path $tools){$toolOwner=Get-Content (Join-Path $tools 'drenv-tool.json') -Raw|ConvertFrom-Json;if($toolOwner.kind -cne 'drenv-azurite' -or $toolOwner.version -cne '3.37.0'){throw 'Foreign Azurite tool directory'};if(Test-Path (Join-Path $tools 'node_modules\azurite\dist\src\azurite.js')){Write-Output 'Updated mini controller; existing owned Azurite retained';return}}
else{New-Item -ItemType Directory -Force $tools|Out-Null;@{kind='drenv-azurite';version='3.37.0'}|ConvertTo-Json|Set-Content (Join-Path $tools 'drenv-tool.json')}
$toolsScript=Join-Path $root 'install-tools.ps1'
$oldTools=Get-ScheduledTask -TaskName 'drenv mini tools install' -ErrorAction SilentlyContinue
if($oldTools){if($oldTools.State -in @('Running','Queued')){throw 'Existing tool installer is active; its script was preserved'};if($oldTools.Actions[0].Execute -ine $pwsh -or $oldTools.Actions[0].Arguments -cne "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $toolsScript"){throw 'Foreign tools task'};Unregister-ScheduledTask -TaskName 'drenv mini tools install' -Confirm:$false}
@"
`$env:Path="`$env:USERPROFILE\AppData\Local\mise\shims;`$env:USERPROFILE\AppData\Local\mise\bin;"+[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
& '$mise' exec node@24 -- npm.cmd install --prefix '$tools' --ignore-scripts --no-audit --no-fund --save-exact azurite@3.37.0 *> '$root\install-tools.log'
exit `$LASTEXITCODE
"@|Set-Content $toolsScript
$toolsAction=New-ScheduledTaskAction -Execute $pwsh -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $toolsScript" -WorkingDirectory $root
Register-ScheduledTask -TaskName 'drenv mini tools install' -Action $toolsAction -Principal (New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited) -Settings (New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15))|Out-Null
Start-ScheduledTask -TaskName 'drenv mini tools install'
Write-Output 'Installed native mini controller and .local\bin\drenv.cmd'
