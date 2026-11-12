$root=Join-Path $env:TEMP ('drenv-client-'+[guid]::NewGuid().ToString('N'))
$script:checks=0
function Check($Condition,[string]$Message){if(-not $Condition){throw $Message};$script:checks++}
function Put([string]$Path,[string]$Text){$file=Join-Path $root $Path;[void][IO.Directory]::CreateDirectory((Split-Path -Parent $file));[IO.File]::WriteAllText($file,$Text)}
function Commit { & git -C $root add --all; & git -C $root -c user.name=Test -c user.email=test@localhost commit --quiet -m fixture; if($LASTEXITCODE -ne 0){throw 'Fixture commit failed'}; return (& git -C $root rev-parse HEAD).Trim() }
try {
    [void][IO.Directory]::CreateDirectory($root)
    & git -C $root init --quiet
    Put 'DevResults/Web/Scripts/app.ts' 'initial'
    Put 'DevResults/DevResults.vbproj' '<Project><ItemGroup><Content Include="Web/Scripts/app.ts" /><Compile Include="Server.vb" /></ItemGroup></Project>'
    $baseline=Commit
    Put 'DevResults/Web/Scripts/app.ts' 'updated'
    $client=Commit
    Check (Test-ClientOnlyRevision $root $baseline $client) 'Client changes must reuse the verified backend build'
    Put 'DevResults/DevResults.vbproj' '<Project><ItemGroup><Content Include="Web/Scripts/new.ts" /><Compile Include="Server.vb" /></ItemGroup></Project>'
    $content=Commit
    Check (Test-ClientOnlyRevision $root $baseline $content) 'Client content registration must not require a backend rebuild'
    Put 'DevResults/DevResults.vbproj' '<Project><ItemGroup><Content Include="Web/Scripts/new.ts" /><Compile Include="Other.vb" /></ItemGroup></Project>'
    $compile=Commit
    Check (-not(Test-ClientOnlyRevision $root $baseline $compile)) 'Backend compilation changes require a full build'
    Put 'pnpm-lock.yaml' 'dependency change'
    $packages=Commit
    Check (-not(Test-ClientOnlyRevision $root $compile $packages)) 'Dependency changes require package restoration'
    Put 'DevResults/Web.config' 'configuration change'
    $config=Commit
    Check (-not(Test-ClientOnlyRevision $root $packages $config)) 'Server configuration changes require a full build'
    Check (-not(Test-ClientOnlyRevision $root ('0'*40) $config)) 'Missing previous revisions require a full build'
    $spec="{`n  `"x-generator`": `"NSwag old`",`n  `"openapi`": `"3.0.0`"`n}"
    Put 'spec.json' $spec
    $before=[IO.File]::ReadAllBytes((Join-Path $root 'spec.json'))
    Put 'spec.json' ($spec.Replace('NSwag old','NSwag new'))
    Restore-GeneratorMetadata (Join-Path $root 'spec.json') $before
    Check ([IO.File]::ReadAllText((Join-Path $root 'spec.json')) -ceq $spec) 'Build-only generator metadata restores the exact committed input'
    Put 'spec.json' ($spec.Replace('NSwag old','NSwag new').Replace("`n","`r`n"))
    Restore-GeneratorMetadata (Join-Path $root 'spec.json') $before
    Check ([IO.File]::ReadAllText((Join-Path $root 'spec.json')) -ceq $spec) 'Native generators may change line endings without changing the contract'
    $contract=$spec.Replace('NSwag old','NSwag new').Replace('3.0.0','3.1.0')
    Put 'spec.json' $contract
    Restore-GeneratorMetadata (Join-Path $root 'spec.json') $before
    Check ([IO.File]::ReadAllText((Join-Path $root 'spec.json')) -ceq $contract) 'Actual contract changes must remain visible to the source cleanliness gate'
    $log=Join-Path $root 'calls.log'
    Put 'bin/node.cmd' ("@echo node %* %DOCXTEMPLATER_HTML_URL%>>`"$log`"`r`n@exit /b %NODE_EXIT%`r`n")
    Put 'bin/pnpm.cmd' ("@echo pnpm %*>>`"$log`"`r`n")
    Put 'home/.secrets' "export OTHER_TOKEN=unrelated`nexport DOCXTEMPLATER_HTML_URL=https://modules.example/html.tgz`n"
    function Invoke-PackagesStep([string]$NodeExit='0') {
        if(Test-Path -LiteralPath $log){Remove-Item -LiteralPath $log}
        $saved=@{Path=$env:Path;USERPROFILE=$env:USERPROFILE;NODE_EXIT=$env:NODE_EXIT}
        $env:Path=(Join-Path $root 'bin')+';'+$env:Path;$env:USERPROFILE=Join-Path $root 'home';$env:NODE_EXIT=$NodeExit
        Push-Location $root
        try{& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -NonInteractive -EncodedCommand ([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes((Get-PackagesStep))));$exit=$LASTEXITCODE}
        finally{Pop-Location;foreach($name in $saved.Keys){Set-Item -Path "Env:$name" -Value $saved[$name]}}
        return @{exit=$exit;calls=@(if(Test-Path -LiteralPath $log){[IO.File]::ReadAllLines($log)})}
    }
    $older=Invoke-PackagesStep
    Check ($older.exit -eq 0 -and $older.calls.Count -eq 1 -and $older.calls[0] -ceq 'pnpm install --frozen-lockfile') 'Revisions without licensed modules install packages directly'
    Put 'scripts/prepare-docxtemplater.ts' ''
    $licensed=Invoke-PackagesStep
    Check ($licensed.exit -eq 0 -and $licensed.calls.Count -eq 2 -and $licensed.calls[0] -ceq 'node --experimental-strip-types scripts\prepare-docxtemplater.ts https://modules.example/html.tgz' -and $licensed.calls[1] -ceq 'pnpm install --frozen-lockfile') 'Licensed modules are prepared with access from ~/.secrets before packages install'
    $failed=Invoke-PackagesStep '3'
    Check ($failed.exit -eq 3 -and $failed.calls.Count -eq 1) 'A failed licensed module download stops the install with its exit code'
    @{passed=$script:checks}|ConvertTo-Json -Compress
} finally {Remove-Item -LiteralPath $root -Recurse -Force}
