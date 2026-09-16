param($Assets)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$script:passed=0
function Check([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message};$script:passed++}
$root=Join-Path $env:TEMP ('drenv-lifecycle-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root)
$one=$null;$two=$null
$m=$null
try {
    # Exercise the actual supervisor readiness loop while listeners appear in stages.
    & {
        $m=@{ports=@{http=31000;https=31001;blob=31002;queue=31003;table=31004}}
        $azurite=123;$state=@{children=@(@{pid=123},@{pid=456})}
        $job=[pscustomobject]@{};$job|Add-Member ScriptMethod IsAlive {param($id) return $true}
        $script:listenerPoll=0;$script:listenerSleeps=0
        function Get-NetTCPConnection {
            param($State,$ErrorAction)
            $script:listenerPoll++
            if($script:listenerPoll -eq 1){return @()}
            if($script:listenerPoll -eq 2){return @([pscustomobject]@{LocalPort=31000;OwningProcess=4},[pscustomobject]@{LocalPort=31001;OwningProcess=4})}
            return @(31000,31001,31002,31003,31004|ForEach-Object {[pscustomobject]@{LocalPort=$_;OwningProcess=123}})
        }
        function Start-Sleep {param($Milliseconds) $script:listenerSleeps++}
        $begin=$Assets.supervisor.IndexOf('$ready=$false')
        $end=$Assets.supervisor.IndexOf("if(`$request.mode -eq 'maintenance')",$begin)
        . ([ScriptBlock]::Create($Assets.supervisor.Substring($begin,$end-$begin)))
        Check ($ready -and $script:listenerPoll -eq 3 -and $script:listenerSleeps -eq 2) 'Supervisor must wait through empty and partial listener inventories'
    }
    Add-Type -TypeDefinition $Assets.job
    $one=[DrenvOwnedJob]::new('Local\drenv-test-'+[guid]::NewGuid().ToString('N'))
    $two=[DrenvOwnedJob]::new('Local\drenv-test-'+[guid]::NewGuid().ToString('N'))
    $exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $childFile=Join-Path $root 'child.txt'
    $spawn='$p=Start-Process powershell.exe -ArgumentList "-NoProfile -NonInteractive -Command Start-Sleep -Seconds 120" -PassThru; [IO.File]::WriteAllText("'+$childFile+'",[string]$p.Id); Start-Sleep -Seconds 120'
    $first=$one.Spawn($exe,'-NoProfile -NonInteractive -EncodedCommand '+[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($spawn)),$root)
    $second=$two.Spawn($exe,'-NoProfile -NonInteractive -Command "Start-Sleep -Seconds 120"',$root)
    for($attempt=0;$attempt -lt 40 -and -not(Test-Path -LiteralPath $childFile);$attempt++){Start-Sleep -Milliseconds 100}
    Check (Test-Path -LiteralPath $childFile) 'Grandchild did not start'
    $grandchild=[int][IO.File]::ReadAllText($childFile)
    $one.Dispose();$one=$null
    Start-Sleep -Milliseconds 400
    Check ($null -eq (Get-Process -Id $first -ErrorAction SilentlyContinue)) 'Owned parent survived job close'
    Check ($null -eq (Get-Process -Id $grandchild -ErrorAction SilentlyContinue)) 'Owned grandchild survived job close'
    Check ($null -ne (Get-Process -Id $second -ErrorAction SilentlyContinue)) 'Other environment did not survive'
    $two.Dispose();$two=$null
    $m=[pscustomobject]@{id=('lifecycle-proof-'+[guid]::NewGuid().ToString('N').Substring(0,8));ownerToken=[guid]::NewGuid().ToString();revision=('a'*40);paths=[pscustomobject]@{windows=(Join-Path $root 'source\proof');runtime=(Join-Path $root 'runtime\proof')};ports=[pscustomobject]@{http=25001;https=25002;blob=25003;queue=25004;table=25005}}
    [void][IO.Directory]::CreateDirectory($m.paths.windows)
    $claim="$($m.paths.windows).drenv-source";[void][IO.Directory]::CreateDirectory($claim)
    Write-JsonAtomic (Join-Path $claim 'owner.json') @{environmentId=$m.id;ownerToken=$m.ownerToken;path=$m.paths.windows}
    $old=$ErrorActionPreference;$ErrorActionPreference='Continue'
    & git -C $m.paths.windows init *> $null
    & git -C $m.paths.windows -c user.name=Codex -c user.email=codex@localhost commit --allow-empty -m fixture *> $null
    $m.revision=(& git -C $m.paths.windows rev-parse HEAD)-join ''
    $ErrorActionPreference=$old
    Check ((Get-AppBuildRecipe 'ARM64' '') -ceq 'msbuild-app-arm') 'Native ARM64 builds need the spatial-library recipe'
    Check ((Get-AppBuildRecipe 'AMD64' 'ARM64') -ceq 'msbuild-app-arm') 'Emulated shells must use the native ARM64 recipe'
    Check ((Get-AppBuildRecipe 'AMD64' '') -ceq 'msbuild-app') 'Native x64 builds retain the standard recipe'
    [void][IO.Directory]::CreateDirectory($m.paths.runtime)
    $firewallName="drenv-$($m.id)-$($m.ownerToken)-https"
    try {
        Ensure-OwnedFirewall $m '10.211.55.2'
        $rule=Get-NetFirewallRule -PolicyStore PersistentStore | Where-Object {$_.Name -ceq $firewallName}
        Check ($null -ne $rule) 'Owned HTTPS rule is created for Mac access'
        Check ((($rule|Get-NetFirewallPortFilter).LocalPort -join ',') -ceq [string]$m.ports.https) 'Only owned HTTPS is allowed'
        Check ((($rule|Get-NetFirewallAddressFilter).RemoteAddress -join ',') -ceq '10.211.55.2') 'HTTPS rule is restricted to the SSH Mac peer'
        Ensure-OwnedFirewall $m '10.211.55.2'
        Set-NetFirewallRule -Name $firewallName -PolicyStore PersistentStore -RemoteAddress Any
        $refused=$false;try{[void](Get-OwnedFirewall $m)}catch{$refused=$_.Exception.Message -like '*firewall*'}
        Check $refused 'Changed firewall filters are refused before cleanup'
        Check ($null -ne (Get-NetFirewallRule -Name $firewallName -PolicyStore PersistentStore)) 'Foreign changed rule remains present'
        Set-NetFirewallRule -Name $firewallName -PolicyStore PersistentStore -RemoteAddress '10.211.55.2'
        Remove-OwnedFirewall $m
        Check (@(Get-NetFirewallRule -PolicyStore PersistentStore|Where-Object {$_.Name -ceq $firewallName}).Count -eq 0) 'Verified owned HTTPS rule is removed'
    } finally {Get-NetFirewallRule -PolicyStore PersistentStore|Where-Object {$_.Name -ceq $firewallName}|Remove-NetFirewallRule}
    & {
        $script:startupFirewallMutation=$false
        function Assert-TlsBinding($Manifest) {}
        function Get-SshPeer {return '10.211.55.2'}
        function Get-ChildItem {return @()}
        function Assert-NoForeignPorts($Manifest,$Claims,$Owned) {Deny 'Reserved port is occupied'}
        function Ensure-OwnedFirewall($Manifest,$Peer) {$script:startupFirewallMutation=$true}
        $refused=$false;try{Initialize-OwnedEndpoints $m}catch{$refused=$_.Exception.Message -like '*port is occupied*'}
        Check $refused 'Occupied reserved endpoint blocks startup'
        Check (-not $script:startupFirewallMutation) 'Occupied reserved endpoint is refused before firewall mutation'
    }
    $artifactRoot=Join-Path $root 'artifact-web'
    foreach($relative in @('bin\DevResults.dll','bin\DevResults.Core.dll','bin\DevResults.Api.dll','Web\dist\scripts\app.js','Web\dist\scripts\admin.js','Web\dist\scripts\prt.js','Web\dist\css\app.css','Web\dist\css\Public.css','Web\dist\css\Bootstrap_Custom.css','Web\dist\css\word.mhtml.css','Web\dist\css\viz.css','Web\dist\css\prt.css')){$file=Join-Path $artifactRoot $relative;[void][IO.Directory]::CreateDirectory((Split-Path -Parent $file));[IO.File]::WriteAllText($file,'fixture')}
    $artifacts=Get-BuildArtifacts $m $artifactRoot
    Check ($artifacts.Count -eq 12) 'Full executable/client artifact inventory differs'
    [void][IO.Directory]::CreateDirectory((Get-Control $m))
    Write-JsonAtomic (Join-Path (Get-Control $m) 'build.json') @{environmentId=$m.id;ownerToken=$m.ownerToken;revision=$m.revision;artifacts=$artifacts}
    Assert-Build $m $artifactRoot
    [IO.File]::WriteAllText((Join-Path $artifactRoot 'Web\dist\scripts\app.js'),'changed')
    $changed=$false;try{Assert-Build $m $artifactRoot}catch{$changed=$_.Exception.Message -like '*artifacts changed*'}
    Check $changed 'Changed client artifact was not refused'
    $result=Start-OwnedSupervisor $m 'build' $Assets @(@{name='fixture';executable=$exe;arguments='-NoProfile -NonInteractive -Command "exit 0"'})
    Check ($result.status -ceq 'built') 'Scheduled supervisor did not finish its child'
    Check (-not(Test-Supervisor $result)) 'Completed supervisor remains alive'
    $state=Get-State $m
    $state.pid=$PID;$state.processStartTime='wrong';$state.status='starting'
    $refused=$false
    try{[void](Test-Supervisor $state)}catch{$refused=$_.Exception.Message -like '*reused*'}
    Check $refused 'Reused PID was not refused'
    $failed=$false
    try{[void](Start-OwnedSupervisor $m 'build' $Assets @(@{name='fixture';executable=$exe;arguments='-NoProfile -NonInteractive -Command "exit 7"'}))}catch{$failed=$_.Exception.Message -like '*supervisor failed*';if(-not $failed){throw ('Unexpected fixture refusal: '+$_.Exception.Message)}}
    Check $failed 'Nonzero child exit was not a failed supervisor'
    $state=Get-State $m
    Check ($state.failure -match 'Build command fixture exited 7 \(RuntimeException, script line \d+\)') 'Failure receipt must identify its stage, exception type, and script line'
    for($attempt=0;$attempt -lt 40 -and (Test-Supervisor $state);$attempt++){Start-Sleep -Milliseconds 100}
    Check (-not(Test-Supervisor $state)) 'Failed supervisor survived'
    # A normal ignored pnpm dependency junction must not block clean worktree removal.
    & {
        function Assert-Catalog($Manifest) {return $false}
        function netsh {$global:LASTEXITCODE=1}
        $linked=$m.PSObject.Copy()
        $linked.id='junction-'+[guid]::NewGuid().ToString('N').Substring(0,8)
        $linked.ownerToken=[guid]::NewGuid().ToString()
        $linked.paths=[pscustomobject]@{windows=(Join-Path $root "source\$($linked.id)");runtime=(Join-Path $root "runtime\$($linked.id)")}
        $linkedClaim="$($linked.paths.windows).drenv-source"
        [void][IO.Directory]::CreateDirectory($linkedClaim)
        $store=Join-Path $linkedClaim 'repository.git'
        $old=$ErrorActionPreference;$ErrorActionPreference='Continue'
        & git clone --bare -- $m.paths.windows $store *> $null
        if($LASTEXITCODE -ne 0){throw 'Junction fixture clone failed'}
        & git -C $store worktree add -b junction-proof -- $linked.paths.windows HEAD *> $null
        if($LASTEXITCODE -ne 0){throw 'Junction fixture worktree failed'}
        [IO.File]::WriteAllText((Join-Path $linked.paths.windows '.gitignore'),"node_modules/`n")
        & git -C $linked.paths.windows add .gitignore *> $null
        & git -C $linked.paths.windows -c user.name=Codex -c user.email=codex@localhost commit -m fixture *> $null
        if($LASTEXITCODE -ne 0){throw 'Junction fixture commit failed'}
        $linked.revision=(& git -C $linked.paths.windows rev-parse HEAD)-join ''
        $ErrorActionPreference=$old
        Write-JsonAtomic (Join-Path $linkedClaim 'owner.json') @{environmentId=$linked.id;ownerToken=$linked.ownerToken;path=$linked.paths.windows}
        $target=Join-Path $root 'external-package-target'
        [void][IO.Directory]::CreateDirectory($target)
        [IO.File]::WriteAllText((Join-Path $target 'preserve.txt'),'external package data')
        $modules=Join-Path $linked.paths.windows 'node_modules'
        [void][IO.Directory]::CreateDirectory($modules)
        [void](New-Item -ItemType Junction -Path (Join-Path $modules 'package') -Target $target)
        Assert-RemovalPreflight $linked $true
        Check $true 'Clean pnpm-style junction passed removal preflight'
        Remove-OwnedData $linked $true
        Check (-not(Test-Path -LiteralPath $linked.paths.windows)) 'Owned linked worktree was not removed'
        Check ([IO.File]::ReadAllText((Join-Path $target 'preserve.txt')) -ceq 'external package data') 'Worktree removal followed junction into external target'
    }
    # A disconnected launcher can leave a queued receipt while Task Scheduler owns the launch.
    $queued=Get-State $m;$queued.pid=0;$queued.status='queued'
    $delayedSupervisor=Join-Path (Split-Path -Parent $queued.request) 'supervisor.ps1'
    [IO.File]::WriteAllText($delayedSupervisor,'Start-Sleep -Seconds 60')
    Write-JsonAtomic (Join-Path (Get-Control $m) 'state.json') $queued
    Start-ScheduledTask -TaskName "drenv-$($m.id)-$($m.ownerToken)"
    $queuedRefused=$false
    try{Stop-OwnedSupervisor $m}catch{$queuedRefused=$_.Exception.Message -like '*queued*'}
    Check $queuedRefused 'Queued task was reported stopped after launcher disconnect'
    foreach($complete in @($false,$true)) {
        $queuedRefused=$false
        try{Remove-OwnedData $m $complete}catch{$queuedRefused=$_.Exception.Message -like '*queued*'}
        Check $queuedRefused 'Queued task did not block reset/removal before data inspection'
    }
    foreach($guard in @('catalog','runtime','writers','firewall','TLS','claim','task','source','reparse','dirty')) {
      & {
        function Stop-OwnedSupervisor($Manifest) {}
        function Assert-Catalog($Manifest) {if($guard -eq 'catalog'){Deny 'guard:catalog'};return $true}
        function Assert-Runtime($Manifest) {if($guard -eq 'runtime'){Deny 'guard:runtime'}}
        function Assert-NoDatabaseWriters($Manifest) {if($guard -eq 'writers'){Deny 'guard:writers'}}
        function Get-OwnedFirewall($Manifest) {if($guard -eq 'firewall'){Deny 'guard:firewall'}}
        function Invoke-Sql($Query) {throw 'DATA MUTATION BEFORE PREFLIGHT'}
        function Assert-SupervisorIdle($Manifest,$State) {if($guard -eq 'task'){Deny 'guard:task'}}
        function netsh { $global:LASTEXITCODE=0;return 'fixture' }
        function Assert-TlsBinding($Manifest) {if($guard -eq 'TLS'){Deny 'guard:TLS'}}
        function Assert-Owner($Owner,$Manifest) {if($guard -eq 'claim'){Deny 'guard:claim'}}
        function Assert-NoReparse($Path) {if($guard -eq 'reparse'){Deny 'guard:reparse'}}
        function Assert-OwnedSource($Manifest) {if($guard -eq 'source'){Deny 'guard:source'}}
        function git {$global:LASTEXITCODE=0;if($guard -eq 'dirty'){return '?? uncommitted.txt'}}
        [void][IO.Directory]::CreateDirectory($m.paths.runtime)
        $refused=$false;try{Remove-OwnedData $m $true}catch{if($guard -eq 'dirty'){$refused=$_.Exception.Message -like '*uncommitted*'}else{$refused=$_.Exception.Message -like "*guard:$guard*"}}
        Check $refused "Removal guard $guard ran after data mutation"
      }
    }
    foreach($scenario in @('transient','persistent','unverified')) {
      & {
        $script:referenceChecks=0
        $script:drainSleeps=0
        function Get-State($Manifest) {if($scenario -ne 'unverified'){return [pscustomobject]@{status='refreshed';pid=123;mode='maintenance'}}}
        function Get-OwnedTask($Manifest,$State) {return [pscustomobject]@{State='Ready'}}
        function Test-Supervisor($State) {return $false}
        function Assert-SupervisorIdle($Manifest,$State) {}
        function Start-Sleep {param($Milliseconds);$script:drainSleeps++}
        function Get-NetTCPConnection {param($State,$ErrorAction);return @()}
        function Assert-NotInUse($Manifest) {
            $script:referenceChecks++
            if($scenario -ne 'transient' -or $script:referenceChecks -lt 3){Deny 'A process still references this environment; stop the verified owned runtime/build before deployment refresh.'}
        }
        $refused=$false
        try{Stop-OwnedSupervisor $m}catch{$refused=$_.Exception.Message -like '*process still references*'}
        if($scenario -eq 'transient'){Check (-not $refused -and $script:referenceChecks -eq 3) 'Terminal supervisor transient process references did not drain'}
        elseif($scenario -eq 'persistent'){Check ($refused -and $script:drainSleeps -gt 0 -and $script:drainSleeps -le 30) 'Persistent process references were ignored or wait was unbounded'}
        else{Check ($refused -and $script:drainSleeps -eq 0) 'Missing supervisor receipt incorrectly authorized a drain wait'}
      }
    }
    $result=@{passed=$script:passed;scope='Real Windows job trees and scheduled launch refusal; removal guards with mutation sentinel'}
} finally {
    if($null -ne $one){$one.Dispose()};if($null -ne $two){$two.Dispose()}
    if($null -ne $m){$name="drenv-$($m.id)-$($m.ownerToken)";if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){Stop-ScheduledTask -TaskName $name;for($attempt=0;$attempt -lt 50 -and (Get-ScheduledTask -TaskName $name).State -eq 'Running';$attempt++){Start-Sleep -Milliseconds 100};if((Get-ScheduledTask -TaskName $name).State -eq 'Running'){throw 'Fixture task did not stop; retain owned fixture'};Unregister-ScheduledTask -TaskName $name -Confirm:$false}}
    for($attempt=0;$attempt -lt 100;$attempt++){$fixtureProcesses=@(Get-CimInstance Win32_Process | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($root,[StringComparison]::OrdinalIgnoreCase) -ge 0});if($fixtureProcesses.Count -eq 0){break};Start-Sleep -Milliseconds 100}
    if($fixtureProcesses.Count){throw 'Fixture process still references owned paths; retain fixture'}
    if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}

$result | ConvertTo-Json -Compress
