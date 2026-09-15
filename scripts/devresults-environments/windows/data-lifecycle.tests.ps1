$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=Join-Path $env:TEMP ('drenv-data-proof-'+[guid]::NewGuid().ToString('N'))
$id='data-proof-'+[guid]::NewGuid().ToString('N').Substring(0,8)
$m=[pscustomobject]@{id=$id;ownerToken=[guid]::NewGuid().ToString();revision=('a'*40);catalog=('drenv_'+$id.Replace('-','_'));data=[pscustomobject]@{instance='example';database='dev'};paths=[pscustomobject]@{windows=(Join-Path $root "source\$id");runtime=(Join-Path $root "runtime\$id")};ports=[pscustomobject]@{http=26001;https=26002;blob=26003;queue=26004;table=26005}}
$created=$false
try {
    foreach($path in @($m.paths.windows,"$($m.paths.windows).drenv-source",$m.paths.runtime,(Join-Path $root 'claims'))){[void][IO.Directory]::CreateDirectory($path)}
    foreach($name in @('sql','blobs','cache','temp','mail','output')){[void][IO.Directory]::CreateDirectory((Join-Path $m.paths.runtime $name))}
    Write-JsonAtomic (Join-Path $m.paths.runtime 'owner.json') @{environmentId=$id;ownerToken=$m.ownerToken}
    Write-JsonAtomic (Join-Path $root "claims\$id.json") @{environmentId=$id;ownerToken=$m.ownerToken;runtime=$m.paths.runtime;catalog=$m.catalog;ports=@(26002,26001,26003,26004,26005)}
    $sqlRoot=Join-Path $m.paths.runtime 'sql'
    $service=Get-CimInstance Win32_Service -Filter "Name='MSSQLSERVER'"
    & icacls $root /grant "$($service.StartName):(OI)(CI)F" | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Fixture SQL directory permission failed'}
    $catalog=Sql-Identifier $m.catalog
    [void](Invoke-Sql "CREATE DATABASE $catalog ON PRIMARY (NAME=N'proof_data',FILENAME=$(Sql-Literal (Join-Path $sqlRoot 'proof.mdf')),SIZE=8MB,FILEGROWTH=8MB) LOG ON (NAME=N'proof_log',FILENAME=$(Sql-Literal (Join-Path $sqlRoot 'proof.ldf')),SIZE=8MB,FILEGROWTH=8MB)")
    $created=$true
    [void](Invoke-Sql "EXEC sys.sp_addextendedproperty @name=N'drenv.environmentId',@value=$(Sql-Literal $m.id); EXEC sys.sp_addextendedproperty @name=N'drenv.ownerToken',@value=$(Sql-Literal $m.ownerToken); CREATE TABLE dbo._Global(_Key nvarchar(50),_Value nvarchar(100)); INSERT dbo._Global VALUES(N'SchemaHash',N'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'); CREATE TABLE dbo.Proof(Value int); INSERT dbo.Proof VALUES(42);" $m.catalog)
    [IO.File]::WriteAllText((Join-Path $m.paths.runtime 'blobs\proof.txt'),'paired snapshot')
    $snapshot=Snapshot-OwnedData $m
    if($snapshot.sourceDatabase -cne $m.catalog -or $snapshot.blobs.bytes -ne 15){throw 'Owned coordinated snapshot receipt differs'}
    $foreign=$m.PSObject.Copy();$foreign.ownerToken=[guid]::NewGuid().ToString()
    $refused=$false;try{Remove-OwnedData $foreign $false}catch{$refused=$true}
    if(-not $refused -or -not(Assert-Catalog $m)){throw 'Foreign token did not preserve catalog'}
    Remove-OwnedData $m $false
    if(Assert-Catalog $m){throw 'Owned reset did not drop catalog'}
    [void](Invoke-Sql "RESTORE DATABASE $catalog FROM DISK=$(Sql-Literal $snapshot.sql.path) WITH CHECKSUM, MOVE N'proof_data' TO $(Sql-Literal (Join-Path $sqlRoot 'restored.mdf')), MOVE N'proof_log' TO $(Sql-Literal (Join-Path $sqlRoot 'restored.ldf'))")
    if(-not(Assert-Catalog $m)){throw 'Restored SQL ownership did not survive'}
    [void](Invoke-Sql "ALTER DATABASE $catalog SET READ_WRITE WITH NO_WAIT")
    [void](Invoke-Sql 'INSERT dbo.Proof VALUES(43)' $m.catalog)
    $row=Invoke-Sql 'SELECT Value FROM dbo.Proof WHERE Value=42' $m.catalog
    if($row.Rows[0].Value -ne 42){throw 'Owned SQL snapshot did not preserve data'}
    Copy-Item -LiteralPath (Join-Path $snapshot.blobs.path 'proof.txt') -Destination (Join-Path $m.paths.runtime 'blobs\proof.txt')
    if((Get-BlobDigest (Join-Path $m.paths.runtime 'blobs')).sha256 -cne $snapshot.blobs.sha256){throw 'Owned blob restore differs'}
    Remove-OwnedData $m $false
    $created=$false
    @{passed=6;scope='Tiny owned SQL/blob snapshot, foreign-token refusal, reset/drop, checksummed restore, data and blob preservation'} | ConvertTo-Json -Compress
} finally {
    if($created -and (Assert-Catalog $m)){[void](Invoke-Sql "DROP DATABASE $(Sql-Identifier $m.catalog)")}
    if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
