# Run after dot-sourcing provision.ps1 without a request. Uses only owned temporary test files.
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('drenv-provision-tests-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($testRoot)
$passed = 0
function Assert-True([bool]$Value, [string]$Message) { if (-not $Value) { throw "Test failed: $Message" } }
function Expect-Refusal([scriptblock]$Action, [string]$Pattern) {
    $refused = $false
    try { & $Action | Out-Null } catch { $refused = $_.Exception.Message -match $Pattern }
    Assert-True $refused "Expected refusal: $Pattern"
}
try {
    $manifest = @{ id = 'test'; ownerToken = [guid]::NewGuid().ToString(); paths = @{ windows = 'C:\DevResultsEnvironments\source\test'; runtime = 'C:\DevResultsEnvironments\runtime\test' }; ports = @{ https = 23000; http = 23001; blob = 23002; queue = 23003; table = 23004 } }
    Expect-Refusal { Assert-Owner @{ environmentId = 'foreign'; ownerToken = $manifest.ownerToken } $manifest } 'Foreign'
    Expect-Refusal { Assert-Owner @{ environmentId = 'test'; ownerToken = 'other' } $manifest } 'Foreign'
    $passed += 2
    $blobs = Join-Path $testRoot 'blobs'; [void][IO.Directory]::CreateDirectory($blobs)
    [IO.File]::WriteAllText((Join-Path $blobs 'one.json'), 'before')
    $before = Get-BlobDigest $blobs
    [IO.File]::WriteAllText((Join-Path $blobs 'one.json'), 'after')
    $after = Get-BlobDigest $blobs
    Assert-True ($before.sha256 -ne $after.sha256) 'Changing captured blob content invalidates its receipt'
    Assert-True ($after.bytes -eq 5) 'Blob size describes actual bytes'
    $passed += 2
    [xml]$settings = '<appSettings><add key="BlobStorageContainer" value="existing-container"/><add key="AutoDbRefresh.Enabled" value="true"/></appSettings>'
    Set-AppSetting $settings 'AutoDbRefresh.Enabled' 'false'
    Assert-True ($settings.SelectSingleNode("/appSettings/add[@key='AutoDbRefresh.Enabled']").value -ceq 'false') 'Schema refresh stays disabled'
    Assert-True ($settings.SelectSingleNode("/appSettings/add[@key='BlobStorageContainer']").value -ceq 'existing-container') 'Container remains compatible with copied blobs'
    $passed += 2
    $template = Join-Path $testRoot 'template.config'; $result = Join-Path $testRoot 'result.config'
    [IO.File]::WriteAllText($template, '<configuration><system.applicationHost><sites><site name="DevResults"><application path="/"><virtualDirectory path="/" physicalPath="C:\foreign"/></application><bindings><binding protocol="http" bindingInformation="*:8080:"/></bindings></site><site name="Foreign"/></sites></system.applicationHost><location path="Foreign"/></configuration>')
    New-OwnedIisConfig $template $result $manifest
    [xml]$iis = [IO.File]::ReadAllText($result)
    Assert-True ($iis.SelectNodes('/configuration/system.applicationHost/sites/site').Count -eq 1) 'Only the personal site is configured'
    Assert-True ($iis.SelectSingleNode('//virtualDirectory').physicalPath -ceq 'C:\DevResultsEnvironments\runtime\test\web') 'IIS uses owned deployment'
    Assert-True ($iis.SelectSingleNode("//binding[@protocol='https']").bindingInformation -ceq '*:23000:') 'IIS uses reserved HTTPS port'
    $passed += 3
    $manifest.paths.runtime = Join-Path $testRoot 'runtime'
    [void][IO.Directory]::CreateDirectory((Join-Path $manifest.paths.runtime 'web\Core\Db'))
    $manifest.catalog = 'drenv_test'
    $settingsTemplate = Join-Path $testRoot 'SecureSettings.config'
    [IO.File]::WriteAllText($settingsTemplate, '<appSettings><add key="BlobStorageContainer" value="existing-container"/><add key="AzureBlobStorageAccount" value="foreign-cloud"/></appSettings>')
    [IO.File]::WriteAllText((Join-Path $manifest.paths.runtime 'web\Web.config'), '<configuration><system.net><mailSettings><smtp deliveryMethod="Network"><specifiedPickupDirectory pickupDirectoryLocation="C:\mail"/></smtp></mailSettings></system.net></configuration>')
    New-OwnedApplicationConfig $manifest $settingsTemplate
    [xml]$web = [IO.File]::ReadAllText((Join-Path $manifest.paths.runtime 'web\Web.config'))
    [xml]$app = [IO.File]::ReadAllText((Join-Path $manifest.paths.runtime 'web\SecureSettings.config'))
    [xml]$connections = [IO.File]::ReadAllText((Join-Path $manifest.paths.runtime 'web\Core\Db\connections.config'))
    Assert-True ($web.SelectSingleNode('//specifiedPickupDirectory').pickupDirectoryLocation -ceq (Join-Path $manifest.paths.runtime 'mail')) 'Mail stays in owned deployment config'
    Assert-True ($app.SelectSingleNode("/appSettings/add[@key='AzureBlobStorageAccount']").value -ceq '') 'Cloud credential path is disabled'
    Assert-True ($app.SelectSingleNode("/appSettings/add[@key='AutoDbRefresh.Enabled']").value -ceq 'false') 'Copied schema is never silently upgraded'
    Assert-True ($connections.SelectSingleNode("/connectionStrings/add[@name='Main']").connectionString -match 'Initial Catalog=drenv_test') 'SQL targets the owned catalog'
    Assert-True ($connections.SelectSingleNode("/connectionStrings/add[@name='AzureBlobStorage']").connectionString -match 'BlobEndpoint=http://127.0.0.1:23002/') 'Blob endpoint targets the reserved port'
    $passed += 5
    $properties = @(@{ name = 'drenv.environmentId'; value = 'test' }, @{ name = 'drenv.ownerToken'; value = $manifest.ownerToken })
    Assert-CatalogMetadata $properties @(@{ physical_name = (Join-Path $manifest.paths.runtime 'sql\0.mdf') }) $manifest
    Expect-Refusal { Assert-CatalogMetadata @() @() $manifest } 'interrupted restore'
    Expect-Refusal { Assert-CatalogMetadata $properties @(@{ physical_name = 'C:\foreign.mdf' }) $manifest } 'foreign SQL files'
    $passed += 2
    $manifest.paths.windows = Join-Path $testRoot 'source'
    [void][IO.Directory]::CreateDirectory((Join-Path $manifest.paths.windows 'DevResults\Core\Db'))
    [IO.File]::WriteAllText((Join-Path $manifest.paths.windows 'DevResults\Web.config'), '<configuration><system.net><mailSettings><smtp><specifiedPickupDirectory pickupDirectoryLocation="C:\mail"/></smtp></mailSettings></system.net></configuration>')
    $manifest.revision = 'a' * 40
    Expect-Refusal { Copy-OwnedApplication $manifest $settingsTemplate } 'lacks ownership'
    Write-JsonAtomic (Join-Path $manifest.paths.runtime 'web\.drenv-deployment.json') @{ environmentId = 'test'; ownerToken = $manifest.ownerToken; state = 'copying' }
    Copy-OwnedApplication $manifest $settingsTemplate
    $deployment = Get-Json (Join-Path $manifest.paths.runtime 'web\.drenv-deployment.json')
    Assert-True ($deployment.state -ceq 'ready' -and $deployment.revision -ceq $manifest.revision) 'Interrupted owned copy recovers to verified revision'
    Assert-True ([IO.File]::ReadAllText((Join-Path $manifest.paths.windows 'DevResults\Web.config')).Contains('C:\mail')) 'Deployment overlay leaves source Web.config unchanged'
    $passed += 3
    function Get-NetTCPConnection { param($State, $LocalPort, $ErrorAction) return @() }
    function netsh { return '' }
    Assert-NoForeignPorts $manifest @() $false
    Expect-Refusal { Assert-NoForeignPorts $manifest @(@{ environmentId = 'another'; ports = @(23002) }) $false } 'another personal environment'
    function Get-NetTCPConnection { param($State, $LocalPort, $ErrorAction) return @{ LocalPort = $LocalPort } }
    Expect-Refusal { Assert-NoForeignPorts $manifest @() $false } 'live listener'
    $passed += 2
    Write-JsonAtomic (Join-Path $testRoot 'journal.json') @{ phase = 'restoring' }
    Write-JsonAtomic (Join-Path $testRoot 'journal.json') @{ phase = 'data-ready' }
    Assert-True ((Get-Json (Join-Path $testRoot 'journal.json')).phase -ceq 'data-ready') 'Journal checkpoints replace atomically'
    $passed++
    @{ passed = $passed; scope = 'Windows helper behavior with temporary files and mocked port inventory; no live provisioning' } | ConvertTo-Json -Compress
} finally { Remove-Item -LiteralPath $testRoot -Recurse -Force }
