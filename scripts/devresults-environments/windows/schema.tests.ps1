param($Assets)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=Join-Path $env:TEMP ('drenv-schema-proof-'+[guid]::NewGuid().ToString('N'))
$probe=$null
try {
    $web=Join-Path $root 'web'
    [void][IO.Directory]::CreateDirectory((Join-Path $web 'bin'))
    $primary='C:\Code\DevResults\DevResults'
    Get-ChildItem -LiteralPath (Join-Path $primary 'bin') -File | Where-Object {$_.Extension -in @('.dll','.config')} | Copy-Item -Destination (Join-Path $web 'bin')
    foreach($relative in @('Core\Db\Sql','Model\Entities\DbSchema')) {
        $destination=Join-Path $web $relative
        [void][IO.Directory]::CreateDirectory($destination)
        Get-ChildItem -LiteralPath (Join-Path $primary $relative) -Force | Copy-Item -Destination $destination -Recurse -Force
    }
    Copy-Item -LiteralPath (Join-Path $primary 'Web.config') -Destination (Join-Path $web 'Web.config')
    $m=[pscustomobject]@{catalog='drenv_schema_probe_unavailable';paths=[pscustomobject]@{runtime=$root};ports=[pscustomobject]@{blob=27003;queue=27004;table=27005}}
    New-OwnedApplicationConfig $m
    [xml]$settings=[IO.File]::ReadAllText((Join-Path $web 'SecureSettings.config'))
    Set-AppSetting $settings 'Observability.Disabled' 'true'
    $settings.Save((Join-Path $web 'SecureSettings.config'))
    $bin=Join-Path $web 'bin'
    $assembly=Join-Path $bin 'Drenv.SchemaProbe.dll'
    $references=@('System.Web.dll')
    Add-Type -TypeDefinition $Assets.schema -ReferencedAssemblies $references -OutputAssembly $assembly
    Add-Type -AssemblyName System.Web
    $probeAssembly=[Reflection.Assembly]::LoadFrom($assembly)
    $probe=[Web.Hosting.ApplicationHost]::CreateApplicationHost($probeAssembly.GetType('DrenvSchemaProbe'),'/',$web)
    $hash=$probe.Compute()
    if($hash -cnotmatch '^[a-f0-9]{64}$'){throw 'Hosted registered schema provider did not return a SHA256'}
    @{passed=1;schemaHash=$hash;scope='Actual registered built provider in a copied hosted application; database connection points to an unavailable disposable catalog, not a live source'} | ConvertTo-Json -Compress
} catch {
    $failure=$_.Exception
    $types=@();while($null -ne $failure){$types+=$failure.GetType().Name;$failure=$failure.InnerException}
    @{failed='Hosted schema fixture failed';types=$types;line=$_.InvocationInfo.ScriptLineNumber;compiler= $(if($_.InvocationInfo.ScriptLineNumber -eq 25){$_.Exception.Message}else{'withheld'})} | ConvertTo-Json -Compress
} finally {
    if($null -ne $probe){$probe.Shutdown()}
    # AppDomain assemblies are released when this short-lived PowerShell process exits. A later caller cleans the fixture.
    @{cleanup=$root} | ConvertTo-Json -Compress
}
