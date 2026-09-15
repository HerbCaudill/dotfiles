param($Request)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Keep refusal messages separate from exception details, which can include configuration secrets.
function Deny([string]$Message) { throw [System.InvalidOperationException]::new("DRENV: $Message") }
function Assert-Owner($Observed, $Manifest) {
    if ($null -eq $Observed -or $Observed.environmentId -cne $Manifest.id -or $Observed.ownerToken -cne $Manifest.ownerToken) { Deny 'Foreign or missing ownership marker; no resource was adopted.' }
}
function Write-JsonAtomic([string]$Path, $Value) {
    $temporary = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
    [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 30), [Text.UTF8Encoding]::new($false))
    if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) } else { [IO.File]::Move($temporary, $Path) }
}
function Get-Json([string]$Path) { return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json) }
function Assert-NativePath([string]$Path) {
    if ($Path -notmatch '^[A-Za-z]:\\' -or [IO.Path]::GetFullPath($Path) -cne $Path -or $Path.Substring(2).Contains(':')) { Deny 'A canonical native Windows path is required.' }
}
function Get-BlobDigest([string]$Root) {
    if (-not [IO.Directory]::Exists($Root)) { Deny 'Coordinated blob snapshot directory is missing.' }
    $lines = [Collections.Generic.List[string]]::new()
    [long]$bytes = 0
    $files = @(Get-ChildItem -LiteralPath $Root -File -Recurse -Force | Sort-Object { $_.FullName.Substring($Root.Length + 1) })
    foreach ($entry in @(Get-Item -LiteralPath $Root) + @(Get-ChildItem -LiteralPath $Root -Recurse -Force)) {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Deny 'Snapshot reparse points are unsupported.' }
    }
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($Root.Length + 1).Replace('\', '/')
        if ($relative -match '[\r\n\t]') { Deny 'Snapshot filenames contain unsupported control characters.' }
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $lines.Add("$relative`t$($file.Length)`t$hash`n")
        $bytes += $file.Length
    }
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes(($lines -join '')))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
    return @{ sha256 = $hash; bytes = $bytes }
}
function Invoke-Sql([string]$Query, [string]$Catalog = 'master') {
    $connection = [Data.SqlClient.SqlConnection]::new("Server=.;Integrated Security=true;Initial Catalog=$Catalog;Encrypt=false;Application Name=drenv")
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandTimeout = 3600
        $command.CommandText = $Query
        $table = [Data.DataTable]::new()
        $adapter = [Data.SqlClient.SqlDataAdapter]::new($command)
        [void]$adapter.Fill($table)
        return ,$table
    } finally { $connection.Dispose() }
}
function Sql-Literal([string]$Value) { return "N'$($Value.Replace("'", "''"))'" }
function Sql-Identifier([string]$Value) { return "[$($Value.Replace(']', ']]'))]" }
function Assert-Snapshot($Snapshot, $Manifest) {
    if ($Snapshot.version -ne 1 -or $Snapshot.sourceDatabase -cne $Manifest.data.database -or $Snapshot.sourceInstance -cne $Manifest.data.instance -or $Snapshot.revision -cne $Manifest.revision -or [string]::IsNullOrWhiteSpace($Snapshot.schemaHash)) { Deny 'Snapshot source or verified schema revision does not match.' }
    if ($Snapshot.coordination.method -cne 'writers-paused' -or [string]::IsNullOrWhiteSpace($Snapshot.coordination.evidence) -or [datetime]$Snapshot.coordination.completedAt -lt [datetime]$Snapshot.coordination.startedAt) { Deny 'A verified coordinated SQL/blob snapshot is required; foreign writers will not be stopped.' }
    Assert-NativePath $Snapshot.sql.path
    Assert-NativePath $Snapshot.blobs.path
    if (-not [IO.File]::Exists($Snapshot.sql.path)) { Deny 'Coordinated SQL backup is missing.' }
    if ((Get-FileHash -LiteralPath $Snapshot.sql.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Snapshot.sql.sha256) { Deny 'SQL snapshot hash mismatch.' }
    $blob = Get-BlobDigest $Snapshot.blobs.path
    if ($blob.sha256 -cne $Snapshot.blobs.sha256 -or $blob.bytes -ne $Snapshot.blobs.bytes) { Deny 'Blob snapshot hash or size mismatch.' }
    $backup = Sql-Literal $Snapshot.sql.path
    $header = Invoke-Sql "RESTORE HEADERONLY FROM DISK=$backup"
    if ($header.Rows.Count -ne 1 -or $header.Rows[0].DatabaseName -cne $Snapshot.sourceDatabase -or $header.Rows[0].BackupType -ne 1) { Deny 'Expected one full SQL backup of the selected source catalog.' }
    [void](Invoke-Sql "RESTORE VERIFYONLY FROM DISK=$backup WITH CHECKSUM")
    $files = Invoke-Sql "RESTORE FILELISTONLY FROM DISK=$backup"
    [long]$allocation = 0
    foreach ($file in $files.Rows) {
        if ($file.Type -notin @('D', 'L')) { Deny 'Only ordinary SQL data and log files are supported.' }
        $allocation += [long]$file.Size
    }
    if ($allocation -ne [long]$Snapshot.sql.allocatedBytes) { Deny 'SQL snapshot allocation does not match the receipt.' }
    return ,$files
}
function Assert-NoForeignPorts($Manifest, $Claims, [bool]$ExistingClaim) {
    $ports = @($Manifest.ports.https, $Manifest.ports.http, $Manifest.ports.blob, $Manifest.ports.queue, $Manifest.ports.table)
    if (@($ports | Select-Object -Unique).Count -ne 5) { Deny 'Windows runtime ports must be distinct.' }
    foreach ($port in $ports) {
        if ($port -lt 20000 -or $port -gt 65535 -or $port -in @(44400)) { Deny 'Requested port is outside the personal allocation range.' }
        foreach ($claim in $Claims) {
            if ($claim.environmentId -cne $Manifest.id -and $port -in @($claim.ports)) { Deny "Windows port $port belongs to another personal environment." }
        }
        if (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count) { Deny "Windows port $port has a live listener; stop only the verified owned runtime before provisioning." }
    }
    $httpState = (& netsh http show sslcert) -join "`n"
    $urlState = (& netsh http show urlacl) -join "`n"
    foreach ($port in $ports) {
        if ($urlState -match ":$port(?:\D|$)") { Deny "HTTP.sys URL reservation on port $port is foreign to this provisioner." }
        if ($httpState -match ":$port(?:\D|$)") {
            if (-not $ExistingClaim -or $port -ne $Manifest.ports.https) { Deny "HTTP.sys already reserves port $port; ownership must be resolved before provisioning." }
            Assert-TlsBinding $Manifest
        }
    }
}
function Assert-TlsBinding($Manifest) {
    $binding = (& netsh http show sslcert "ipport=0.0.0.0:$($Manifest.ports.https)") -join "`n"
    $appId = ([guid]$Manifest.ownerToken).ToString()
    if ($binding -notmatch [regex]::Escape($appId)) { Deny 'HTTPS binding has foreign ownership.' }
}
function Set-AppSetting($Xml, [string]$Name, [string]$Value) {
    $existing = @($Xml.SelectNodes('/appSettings/add') | Where-Object { $_.GetAttribute('key') -ceq $Name })
    foreach ($node in $existing) { [void]$node.ParentNode.RemoveChild($node) }
    $node = $Xml.CreateElement('add'); $node.SetAttribute('key', $Name); $node.SetAttribute('value', $Value)
    [void]$Xml.DocumentElement.AppendChild($node)
}
function Assert-OwnedSource($Manifest) {
    $claimPath = "$($Manifest.paths.windows).drenv-source\owner.json"
    if (-not [IO.File]::Exists($claimPath)) { Deny 'Paired source ownership marker is missing.' }
    $claim = Get-Json $claimPath; Assert-Owner $claim $Manifest
    if ($claim.path -cne $Manifest.paths.windows) { Deny 'Paired source marker path differs.' }
    $head = (& git -C $Manifest.paths.windows rev-parse HEAD) -join ''
    if ($LASTEXITCODE -ne 0 -or $head -cne $Manifest.revision) { Deny 'Windows source is not at the frozen compatible revision.' }
    $top = (& git -C $Manifest.paths.windows rev-parse --show-toplevel) -join ''
    if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($top) -ine $Manifest.paths.windows) { Deny 'Windows source is not the mapped worktree root.' }
    $dirty = (& git -C $Manifest.paths.windows status --porcelain --untracked-files=no) -join ''
    if ($LASTEXITCODE -ne 0 -or $dirty) { Deny 'Commit and sync tracked source changes before provisioning or deployment refresh.' }
    $common = (& git -C $Manifest.paths.windows rev-parse --path-format=absolute --git-common-dir) -join ''
    if ($LASTEXITCODE -ne 0 -or [IO.Path]::GetFullPath($common) -ine "$($Manifest.paths.windows).drenv-source\repository.git") { Deny 'Windows source Git store has foreign ownership.' }

}
function Assert-NoReparse([string]$Path, [bool]$Recurse = $true) {
    $cursor = $Path
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Deny 'Owned runtime and source paths must not traverse reparse points.' }
        }
        $cursor = Split-Path -Parent $cursor
    }
    if ($Recurse -and [IO.Directory]::Exists($Path)) {
        foreach ($entry in @(Get-ChildItem -LiteralPath $Path -Recurse -Force)) {
            if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Deny 'Deployment copies may not contain junctions or symlinks.' }
        }
    }
}
function Assert-NotInUse($Manifest) {
    foreach ($process in @(Get-CimInstance Win32_Process)) {
        if ($process.ProcessId -ne $PID -and $process.CommandLine -and ($process.CommandLine.IndexOf($Manifest.paths.runtime, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or $process.CommandLine.IndexOf($Manifest.paths.windows, [StringComparison]::OrdinalIgnoreCase) -ge 0)) {
            Deny 'A process still references this environment; stop the verified owned runtime/build before deployment refresh.'
        }
    }
}
function Get-DeploymentEntries([string]$Directory) {
    Assert-NoReparse $Directory $false
    foreach ($entry in @(Get-ChildItem -LiteralPath $Directory -Force)) {
        if ($entry.Name -in @('node_modules', '.git', '.azurite', '.drenv-deployment.json')) { continue }
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Deny 'Deployment copies may not contain junctions or symlinks.' }
        $entry
        if ($entry.PSIsContainer) { Get-DeploymentEntries $entry.FullName }
    }
}
function Get-DeploymentBytes($Manifest) {
    $source = Join-Path $Manifest.paths.windows 'DevResults'
    if (-not [IO.File]::Exists((Join-Path $source 'Web.config'))) { Deny 'Paired source application is missing Web.config.' }
    [long]$total = 0
    foreach ($entry in @(Get-DeploymentEntries $source)) { if (-not $entry.PSIsContainer) { $total += $entry.Length } }
    return $total
}
function Copy-OwnedApplication($Manifest, [string]$SettingsTemplate = 'C:\Code\DevResults\DevResults\SecureSettings.config') {
    $source = Join-Path $Manifest.paths.windows 'DevResults'
    $entries = @(Get-DeploymentEntries $source)
    $destination = Join-Path $Manifest.paths.runtime 'web'
    $marker = Join-Path $destination '.drenv-deployment.json'
    if ([IO.Directory]::Exists($destination)) {
        if (-not [IO.File]::Exists($marker)) { Deny 'Existing deployment directory lacks ownership; no files were removed.' }
        Assert-Owner (Get-Json $marker) $Manifest
        Assert-NoReparse $destination
        Remove-Item -LiteralPath $destination -Recurse -Force
    }
    [void][IO.Directory]::CreateDirectory($destination)
    Write-JsonAtomic $marker @{ environmentId = $Manifest.id; ownerToken = $Manifest.ownerToken; revision = $Manifest.revision; state = 'copying' }
    foreach ($entry in $entries) {
        $target = Join-Path $destination $entry.FullName.Substring($source.Length + 1)
        if ($entry.PSIsContainer) { [void][IO.Directory]::CreateDirectory($target) }
        else { Copy-Item -LiteralPath $entry.FullName -Destination $target -Force }
    }
    New-OwnedApplicationConfig $Manifest $SettingsTemplate
    Write-JsonAtomic $marker @{ environmentId = $Manifest.id; ownerToken = $Manifest.ownerToken; revision = $Manifest.revision; state = 'ready' }
}
function Start-RestoreJournal($Manifest, $Snapshot, [bool]$DatabaseExists) {
    $sqlPath = Join-Path $Manifest.paths.runtime 'sql'
    if (-not $DatabaseExists -and [IO.Directory]::Exists($sqlPath) -and @(Get-ChildItem -LiteralPath $sqlPath -Force).Count -gt 0) { Deny 'Interrupted SQL files exist; recover the exact owned restore before retrying.' }
    $journalPath = Join-Path $Manifest.paths.runtime 'provision-journal.json'
    Write-JsonAtomic $journalPath @{ environmentId = $Manifest.id; ownerToken = $Manifest.ownerToken; phase = 'restoring'; revision = $Manifest.revision; snapshot = $Snapshot; pid = $PID; processStartTime = (Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o'); startedAt = [datetime]::UtcNow.ToString('o') }
}
function Assert-CatalogMetadata($Properties, $Files, $Manifest) {
    $owner = @{}; foreach ($row in $Properties) { $owner[$row.name] = $row.value }
    if ($owner['drenv.environmentId'] -cne $Manifest.id -or $owner['drenv.ownerToken'] -cne $Manifest.ownerToken) { Deny 'Destination catalog is foreign or an interrupted restore lacks SQL ownership; inspect the Windows journal and recover that exact restore before retrying.' }
    $sqlRoot = (Join-Path $Manifest.paths.runtime 'sql') + '\'
    foreach ($file in $Files) {
        if (-not $file.physical_name.StartsWith($sqlRoot, [StringComparison]::OrdinalIgnoreCase)) { Deny 'Owned catalog references foreign SQL files.' }
    }
}
function New-OwnedApplicationConfig($Manifest, [string]$SettingsTemplate = 'C:\Code\DevResults\DevResults\SecureSettings.config') {
    $settingsPath = Join-Path $Manifest.paths.runtime 'web\SecureSettings.config'
    $connectionsPath = Join-Path $Manifest.paths.runtime 'web\Core\Db\connections.config'
    if (-not [IO.File]::Exists($settingsTemplate)) { Deny 'Local SecureSettings.config template is required.' }
    [xml]$settings = [IO.File]::ReadAllText($settingsTemplate)
    Set-AppSetting $settings 'AppTempPath' (Join-Path $Manifest.paths.runtime 'temp')
    Set-AppSetting $settings 'DiskCachePath' (Join-Path $Manifest.paths.runtime 'cache')
    Set-AppSetting $settings 'AutoDbRefresh.Enabled' 'false'
    Set-AppSetting $settings 'AzureBlobStorageAccount' ''
    $secretPath = Join-Path $Manifest.paths.runtime 'azurite-secret.json'
    if ([IO.File]::Exists($secretPath)) { $secret = Get-Json $secretPath } else {
        $key = New-Object byte[] 64
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($key) } finally { $rng.Dispose() }
        $secret = @{ account = 'devstoreaccount1'; key = [Convert]::ToBase64String($key) }
        Write-JsonAtomic $secretPath $secret
    }
    [xml]$connections = '<connectionStrings />'
    $sql = $connections.CreateElement('add'); $sql.SetAttribute('name', 'Main'); $sql.SetAttribute('providerName', 'System.Data.SqlClient')
    $sql.SetAttribute('connectionString', "Server=.;Integrated Security=true;Initial Catalog=$($Manifest.catalog);Encrypt=false")
    [void]$connections.DocumentElement.AppendChild($sql)
    $azure = $connections.CreateElement('add'); $azure.SetAttribute('name', 'AzureBlobStorage')
    $azure.SetAttribute('connectionString', "DefaultEndpointsProtocol=http;AccountName=$($secret.account);AccountKey=$($secret.key);BlobEndpoint=http://127.0.0.1:$($Manifest.ports.blob)/$($secret.account);QueueEndpoint=http://127.0.0.1:$($Manifest.ports.queue)/$($secret.account);TableEndpoint=http://127.0.0.1:$($Manifest.ports.table)/$($secret.account)")
    [void]$connections.DocumentElement.AppendChild($azure)
    $settings.Save($settingsPath); $connections.Save($connectionsPath)
    $webPath = Join-Path $Manifest.paths.runtime 'web\Web.config'
    [xml]$web = [IO.File]::ReadAllText($webPath)
    $smtp = $web.SelectSingleNode('/configuration/system.net/mailSettings/smtp')
    if ($null -eq $smtp) { Deny 'Deployment Web.config is missing mail settings; no runtime was started.' }
    $smtp.SetAttribute('deliveryMethod', 'SpecifiedPickupDirectory')
    $pickup = $smtp.SelectSingleNode('specifiedPickupDirectory')
    if ($null -eq $pickup) { $pickup = $web.CreateElement('specifiedPickupDirectory'); [void]$smtp.AppendChild($pickup) }
    $pickup.SetAttribute('pickupDirectoryLocation', (Join-Path $Manifest.paths.runtime 'mail'))
    $web.Save($webPath)
}
function New-OwnedIisConfig([string]$Template, [string]$Destination, $Manifest) {
    [xml]$xml = [IO.File]::ReadAllText($Template)
    $sites = $xml.SelectSingleNode('/configuration/system.applicationHost/sites')
    $site = $sites.SelectSingleNode("site[@name='DevResults']")
    if ($null -eq $site) { Deny 'IIS template does not contain the DevResults site.' }
    foreach ($other in @($sites.SelectNodes('site'))) { if ($other -ne $site) { [void]$sites.RemoveChild($other) } }
    $virtual = $site.SelectSingleNode("application[@path='/']/virtualDirectory[@path='/']")
    $virtual.SetAttribute('physicalPath', (Join-Path $Manifest.paths.runtime 'web'))
    $bindings = $site.SelectSingleNode('bindings'); $bindings.RemoveAll()
    foreach ($pair in @(@('https', $Manifest.ports.https), @('http', $Manifest.ports.http))) {
        $binding = $xml.CreateElement('binding'); $binding.SetAttribute('protocol', $pair[0]); $binding.SetAttribute('bindingInformation', "*:$($pair[1]):")
        [void]$bindings.AppendChild($binding)
    }
    foreach ($location in @($xml.SelectNodes('/configuration/location'))) {
        if ($location.GetAttribute('path') -notin @('DevResults', '.')) { [void]$location.ParentNode.RemoveChild($location) }
    }
    $xml.Save($Destination)
}

if ($null -eq $Request) { return }
$lock = $null
try {
    $m = $Request.manifest; $snapshot = $Request.snapshot
    if ($m.id -cnotmatch '^[a-z][a-z0-9-]{0,39}$' -or $m.catalog -cnotmatch '^drenv_[a-z0-9_]+$' -or $m.revision -cnotmatch '^[a-f0-9]{40}$') { Deny 'Invalid environment identity or frozen revision.' }
    [void][guid]::Parse($m.ownerToken)
    Assert-NativePath $m.paths.runtime; Assert-NativePath $m.paths.windows
    Assert-NoReparse $m.paths.runtime
    $runtimeParent = Split-Path -Parent $m.paths.runtime
    if ((Split-Path -Leaf $m.paths.runtime) -cne $m.id -or (Split-Path -Leaf $runtimeParent) -cne 'runtime') { Deny 'Runtime path must be the reserved personal runtime/id directory.' }
    $hostRoot = Split-Path -Parent $runtimeParent
    if ($m.paths.windows -cne (Join-Path (Join-Path $hostRoot 'source') $m.id)) { Deny 'Source and runtime paths must share the personal environment root.' }
    if (-not [IO.Directory]::Exists($hostRoot)) { Deny 'Paired personal source root is missing.' }
    $lock = [IO.File]::Open((Join-Path $hostRoot 'provision.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $markerPath = Join-Path $m.paths.runtime 'owner.json'
    $existing = [IO.Directory]::Exists($m.paths.runtime)
    if ($existing) {
        if (-not [IO.File]::Exists($markerPath)) { Deny 'Existing runtime directory has no ownership marker.' }
        Assert-Owner (Get-Json $markerPath) $m
    }
    $claimsDir = Join-Path $hostRoot 'claims'
    $claims = @()
    if ([IO.Directory]::Exists($claimsDir)) { $claims = @(Get-ChildItem -LiteralPath $claimsDir -Filter '*.json' | ForEach-Object { Get-Json $_.FullName }) }
    $claimPath = Join-Path $claimsDir "$($m.id).json"
    $claimed = [IO.File]::Exists($claimPath)
    if ($claimed) {
        $claim = Get-Json $claimPath; Assert-Owner $claim $m
        if ($claim.runtime -cne $m.paths.runtime -or $claim.catalog -cne $m.catalog -or (@($claim.ports) -join ',') -cne (@($m.ports.https, $m.ports.http, $m.ports.blob, $m.ports.queue, $m.ports.table) -join ',')) { Deny 'Windows resource claim differs from the reserved manifest.' }
    }
    Assert-NoForeignPorts $m $claims $claimed
    Assert-OwnedSource $m
    Assert-NotInUse $m
    $deploymentBytes = Get-DeploymentBytes $m
    if ($Request.operation -eq 'refresh') {
        if (-not $existing -or -not $claimed) { Deny 'Deployment refresh requires a provisioned owned runtime.' }
        $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($m.paths.runtime))
        if ($drive.AvailableFreeSpace -lt ($deploymentBytes + 512MB)) { Deny 'Expand Windows disk: deployment refresh needs the complete app copy plus 512 MiB free.' }
        Copy-OwnedApplication $m
        @{ ok = $true; environmentId = $m.id; ownerToken = $m.ownerToken; revision = $m.revision; status = 'refreshed' } | ConvertTo-Json -Compress
        return
    }
    $files = Assert-Snapshot $snapshot $m
    $catalogLiteral = Sql-Literal $m.catalog
    $catalogs = Invoke-Sql "SELECT name FROM sys.databases WHERE name=$catalogLiteral"
    $databaseExists = $catalogs.Rows.Count -gt 0
    if ($databaseExists) {
        if (-not $existing -or -not $claimed) { Deny 'Destination SQL catalog already exists without matching runtime ownership.' }
        $previousJournalPath = Join-Path $m.paths.runtime 'provision-journal.json'
        if (-not [IO.File]::Exists($previousJournalPath)) { Deny 'Existing catalog lacks its provisioning journal; explicit recovery is required.' }
        $previous = Get-Json $previousJournalPath; Assert-Owner $previous $m
        if ($previous.snapshot.sql.sha256 -cne $snapshot.sql.sha256 -or $previous.snapshot.blobs.sha256 -cne $snapshot.blobs.sha256) { Deny 'Retry snapshot differs from restored data; use explicit owned reset instead.' }
        $properties = Invoke-Sql "SELECT name, CONVERT(nvarchar(4000),value) AS value FROM sys.extended_properties WHERE class=0 AND name IN ('drenv.environmentId','drenv.ownerToken')" $m.catalog
        $ownedFiles = Invoke-Sql 'SELECT physical_name FROM sys.database_files' $m.catalog
        Assert-CatalogMetadata $properties.Rows $ownedFiles.Rows $m
    }
    $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($m.paths.runtime))
    [long]$needed = [long]$snapshot.blobs.bytes + $deploymentBytes + 2GB
    if (-not $databaseExists) { $needed += [long]$snapshot.sql.allocatedBytes }
    if ($drive.AvailableFreeSpace -lt $needed) { Deny ('Expand Windows ' + $drive.Name + ': provisioning requires at least ' + [math]::Round($needed / 1GB, 2) + ' GiB free; currently ' + [math]::Round($drive.AvailableFreeSpace / 1GB, 2) + ' GiB. Existing data will not be deleted.') }
    $admin = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Deny 'Elevated Windows SSH is required for owned HTTP.sys TLS binding.' }
    $certificates = @(Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) -and $_.Subject -like '*devlocal.us*' } | Sort-Object NotAfter -Descending)
    if ($certificates.Count -eq 0) { Deny 'A current devlocal.us TLS certificate with private key is required.' }
    $certificate = $certificates[0]
    $template = Join-Path $m.paths.windows '.vs\DevResults\config\applicationhost.config'
    if (-not [IO.File]::Exists($template)) { $template = 'C:\Code\DevResults\.vs\DevResults\config\applicationhost.config' }
    if (-not [IO.File]::Exists($template)) { Deny 'A local IIS Express DevResults applicationhost template is required.' }
    if ($Request.operation -eq 'verify') {
        @{ ok = $true; environmentId = $m.id; ownerToken = $m.ownerToken; revision = $m.revision; status = 'verified' } | ConvertTo-Json -Compress
        return
    }
    if ($Request.operation -ne 'provision') { Deny 'Unsupported provisioning operation.' }
    if (-not $existing) {
        [void][IO.Directory]::CreateDirectory($runtimeParent)
        # New-Item refuses an existing directory; the host lock serializes personal creations.
        [void](New-Item -ItemType Directory -Path $m.paths.runtime -ErrorAction Stop)
        Write-JsonAtomic $markerPath @{ environmentId = $m.id; ownerToken = $m.ownerToken }
    }
    [void][IO.Directory]::CreateDirectory($claimsDir)
    if (-not $claimed) { Write-JsonAtomic $claimPath @{ environmentId = $m.id; ownerToken = $m.ownerToken; runtime = $m.paths.runtime; catalog = $m.catalog; ports = @($m.ports.https, $m.ports.http, $m.ports.blob, $m.ports.queue, $m.ports.table) } }
    foreach ($name in @('sql', 'blobs', 'cache', 'temp', 'mail', 'output', 'iis')) { [void][IO.Directory]::CreateDirectory((Join-Path $m.paths.runtime $name)) }
    $sqlService = Get-CimInstance Win32_Service -Filter "Name='MSSQLSERVER'"
    if ($null -eq $sqlService -or [string]::IsNullOrWhiteSpace($sqlService.StartName)) { Deny 'Default SQL Server service identity is required to grant access to owned SQL files.' }
    & icacls (Join-Path $m.paths.runtime 'sql') /grant "$($sqlService.StartName):(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { Deny 'Could not grant SQL Server access to the owned SQL directory.' }
    $journalPath = Join-Path $m.paths.runtime 'provision-journal.json'
    Start-RestoreJournal $m $snapshot $databaseExists
    if (-not $databaseExists) {
        $moves = [Collections.Generic.List[string]]::new(); $index = 0
        foreach ($file in $files.Rows) {
            $extension = if ($file.Type -eq 'L') { 'ldf' } else { 'mdf' }
            $destination = Join-Path (Join-Path $m.paths.runtime 'sql') "$index.$extension"
            if ([IO.File]::Exists($destination)) { Deny 'Interrupted SQL files exist; recover the exact owned restore before retrying.' }
            $moves.Add("MOVE $(Sql-Literal $file.LogicalName) TO $(Sql-Literal $destination)"); $index++
        }
        [void](Invoke-Sql "RESTORE DATABASE $(Sql-Identifier $m.catalog) FROM DISK=$(Sql-Literal $snapshot.sql.path) WITH CHECKSUM, RECOVERY, $($moves -join ', ')")
        [void](Invoke-Sql "IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'drenv.environmentId') EXEC sys.sp_updateextendedproperty @name=N'drenv.environmentId', @value=$(Sql-Literal $m.id); ELSE EXEC sys.sp_addextendedproperty @name=N'drenv.environmentId', @value=$(Sql-Literal $m.id); IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE class=0 AND name=N'drenv.ownerToken') EXEC sys.sp_updateextendedproperty @name=N'drenv.ownerToken', @value=$(Sql-Literal $m.ownerToken); ELSE EXEC sys.sp_addextendedproperty @name=N'drenv.ownerToken', @value=$(Sql-Literal $m.ownerToken);" $m.catalog)
    }
    $schema = Invoke-Sql "SELECT _Value FROM dbo._Global WHERE _Key=N'SchemaHash'" $m.catalog
    if ($schema.Rows.Count -ne 1 -or $schema.Rows[0]._Value -cne $snapshot.schemaHash) { Deny 'Restored SQL schema hash does not match the compatible snapshot receipt.' }
    $blobDestination = Join-Path $m.paths.runtime 'blobs'
    if (@(Get-ChildItem -LiteralPath $blobDestination -Force).Count -eq 0) { Copy-Item -Path (Join-Path $snapshot.blobs.path '*') -Destination $blobDestination -Recurse -Force }
    $copied = Get-BlobDigest $blobDestination
    if ($copied.sha256 -cne $snapshot.blobs.sha256) { Deny 'Owned blob copy is incomplete or changed; inspect it before explicit recovery.' }
    Copy-OwnedApplication $m
    New-OwnedIisConfig $template (Join-Path $m.paths.runtime 'iis\applicationhost.config') $m
    $tls = (& netsh http show sslcert "ipport=0.0.0.0:$($m.ports.https)") -join "`n"
    if ($LASTEXITCODE -eq 0) { Assert-TlsBinding $m } else {
        & netsh http add sslcert "ipport=0.0.0.0:$($m.ports.https)" "certhash=$($certificate.Thumbprint)" "appid={$($m.ownerToken)}" 'certstorename=MY' | Out-Null
        if ($LASTEXITCODE -ne 0) { Deny 'Could not create owned TLS binding; no foreign binding was changed.' }
        Assert-TlsBinding $m
    }
    Write-JsonAtomic $journalPath @{ environmentId = $m.id; ownerToken = $m.ownerToken; phase = 'data-ready'; revision = $m.revision; snapshot = $snapshot; pid = $PID; completedAt = [datetime]::UtcNow.ToString('o') }
    @{ ok = $true; environmentId = $m.id; ownerToken = $m.ownerToken; revision = $m.revision; status = 'provisioned' } | ConvertTo-Json -Compress
} catch {
    $message = 'Windows provisioning failed; inspect owned journal and Windows prerequisites. Raw diagnostics withheld to protect configuration secrets.'
    if ($_.Exception.Message.StartsWith('DRENV: ')) { $message = $_.Exception.Message.Substring(7) }
    @{ ok = $false; prerequisite = $message } | ConvertTo-Json -Compress
} finally { if ($null -ne $lock) { $lock.Dispose() } }
