$root=Join-Path $env:TEMP ('drenv-artifacts-'+[guid]::NewGuid().ToString('N'))
$script:checks=0
function Check($Condition,[string]$Message){if(-not $Condition){throw $Message};$script:checks++}
function Put([string]$Relative){$path=Join-Path $root $Relative;[void][IO.Directory]::CreateDirectory((Split-Path -Parent $path));[IO.File]::WriteAllText($path,'fixture')}
function Refuses([string]$Message){$failed=$false;try{[void](Get-BuildArtifacts $null $root)}catch{$failed=$true};Check $failed $Message}
try {
    foreach($name in @('DevResults','DevResults.Core','DevResults.Api')){Put "bin\$name.dll"}
    $entries=[ordered]@{}
    foreach($name in @('app','admin','prt','publicApp','Public','Bootstrap_Custom','word.mhtml','viz')){
        $entry=@{file="scripts/$name-hash.js";name=$name;isEntry=$true}
        Put "Web\dist\scripts\$name-hash.js"
        if($name -notin @('admin','publicApp')){$entry.css=@("css/$name.css");Put "Web\dist\css\$name.css"}
        $entries["source/$name.ts"]=$entry
    }
    $entries['source/app.ts'].imports=@('_shared.js')
    $entries['_shared.js']=@{file='scripts/shared-hash.js';assets=@('assets/image.png')}
    Put 'Web\dist\scripts\shared-hash.js';Put 'Web\dist\assets\image.png'
    $manifest=Join-Path $root 'Web\dist\.vite\manifest.json'
    [void][IO.Directory]::CreateDirectory((Split-Path -Parent $manifest))
    [IO.File]::WriteAllText($manifest,($entries|ConvertTo-Json -Depth 8))
    $json=[IO.File]::ReadAllText($manifest)
    $json=$json.TrimEnd().TrimEnd('}')+',"Case.png":{"file":"assets/image.png"},"case.png":{"file":"assets/image.png"}}'
    [IO.File]::WriteAllText($manifest,$json)
    $artifacts=Get-BuildArtifacts $null $root
    Check ($artifacts.Count -eq 20) 'Manifest build must include all DLLs, entries, styles, dependencies and manifest'
    $before=($artifacts|Where-Object {$_.path -eq 'Web\dist\assets\image.png'}).sha256
    [IO.File]::WriteAllText((Join-Path $root 'Web\dist\assets\image.png'),'changed')
    $after=((Get-BuildArtifacts $null $root)|Where-Object {$_.path -eq 'Web\dist\assets\image.png'}).sha256
    Check ($before -ne $after) 'Nested asset changes must change their recorded hash'
    Remove-Item -LiteralPath (Join-Path $root 'Web\dist\assets\image.png')
    Refuses 'Missing referenced assets must be refused';Put 'Web\dist\assets\image.png'
    $entries.Remove('source/admin.ts');[IO.File]::WriteAllText($manifest,($entries|ConvertTo-Json -Depth 8))
    Refuses 'Missing required entry must be refused'
    $entries['source/admin.ts']=@{file='scripts/admin-hash.js';name='admin';isEntry=$true}
    $entries['source/app.ts'].imports=@('_absent.js');[IO.File]::WriteAllText($manifest,($entries|ConvertTo-Json -Depth 8))
    Refuses 'Unresolved imports must be refused'
    $entries['source/app.ts'].imports=@('_shared.js');$entries['_shared.js'].file='../escape.js'
    [IO.File]::WriteAllText($manifest,($entries|ConvertTo-Json -Depth 8));Refuses 'Manifest output paths must stay inside dist'
    [IO.File]::WriteAllText($manifest,'{broken');Refuses 'Malformed manifest must be refused'
    Remove-Item -LiteralPath (Join-Path $root 'Web\dist') -Recurse -Force
    foreach($name in @('app','admin','prt')){Put "Web\dist\scripts\$name.js"}
    foreach($name in @('app','Public','Bootstrap_Custom','word.mhtml','viz','prt')){Put "Web\dist\css\$name.css"}
    Check ((Get-BuildArtifacts $null $root).Count -eq 12) 'Fixed-output revisions remain supported'
    Remove-Item -LiteralPath (Join-Path $root 'Web\dist\scripts\app.js');Refuses 'Incomplete fixed-output build must be refused'
    @{passed=$script:checks}|ConvertTo-Json -Compress
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
