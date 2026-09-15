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
    $artifactRoot=Join-Path $root 'artifact-web'
    foreach($relative in @('bin\DevResults.dll','bin\DevResults.Core.dll','bin\DevResults.Api.dll','Web\dist\.vite\manifest.json','Web\dist\app.js')){$file=Join-Path $artifactRoot $relative;[void][IO.Directory]::CreateDirectory((Split-Path -Parent $file));[IO.File]::WriteAllText($file,'fixture')}
    $artifacts=Get-BuildArtifacts $m $artifactRoot
    Check ($artifacts.Count -eq 5) 'Full executable/client artifact inventory differs'
    [void][IO.Directory]::CreateDirectory((Get-Control $m))
    Write-JsonAtomic (Join-Path (Get-Control $m) 'build.json') @{environmentId=$m.id;ownerToken=$m.ownerToken;revision=$m.revision;artifacts=$artifacts}
    Assert-Build $m $artifactRoot
    [IO.File]::WriteAllText((Join-Path $artifactRoot 'Web\dist\app.js'),'changed')
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
    for($attempt=0;$attempt -lt 40 -and (Test-Supervisor $state);$attempt++){Start-Sleep -Milliseconds 100}
    Check (-not(Test-Supervisor $state)) 'Failed supervisor survived'
    @{passed=$script:passed;scope='Real Windows kill-on-close job trees, cross-environment survival, scheduled supervisor success/failure and PID reuse refusal'} | ConvertTo-Json -Compress
} finally {
    if($null -ne $one){$one.Dispose()};if($null -ne $two){$two.Dispose()}
    if($null -ne $m){$name="drenv-$($m.id)-$($m.ownerToken)";if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){Unregister-ScheduledTask -TaskName $name -Confirm:$false}}
    if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
