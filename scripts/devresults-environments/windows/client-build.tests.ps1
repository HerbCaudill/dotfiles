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
    @{passed=$script:checks}|ConvertTo-Json -Compress
} finally {Remove-Item -LiteralPath $root -Recurse -Force}
