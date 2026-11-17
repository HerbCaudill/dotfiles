param([string]$Directory = 'C:\Code\HerbCaudill\dotfiles\home\.claude\skills\personal-info')

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $allowed = @('personal-info.md', 'low-stakes-passwords.json')
    if ($payload.files.Count -ne 2 -or @($payload.files.name | Select-Object -Unique).Count -ne 2) {
        throw 'Invalid file list'
    }
    # Validate the entire transfer before replacing either destination.
    $files = @($payload.files | ForEach-Object {
        if ($_.name -cnotin $allowed) { throw 'Unexpected file' }
        $bytes = [Convert]::FromBase64String($_.contents)
        $hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
        if ($bytes.Length -eq 0 -or $hash -cne $_.sha256) { throw 'Invalid contents' }
        [PSCustomObject]@{ name = $_.name; bytes = $bytes; sha256 = $hash }
    })

    [IO.Directory]::CreateDirectory($Directory) | Out-Null
    $user = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [Security.AccessControl.FileSecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($user)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($user, 'FullControl', 'Allow'))

    $receipts = @($files | ForEach-Object {
        $path = Join-Path $Directory $_.name
        $changed = $true
        if ([IO.File]::Exists($path)) {
            $existing = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($path))).ToLowerInvariant()
            $changed = $existing -cne $_.sha256
        }
        if ($changed) {
            $temporary = "$path.$([Guid]::NewGuid()).tmp"
            try {
                # Protect the empty temporary file before writing private contents.
                [IO.File]::WriteAllBytes($temporary, [byte[]]@())
                Set-Acl -LiteralPath $temporary -AclObject $acl
                [IO.File]::WriteAllBytes($temporary, $_.bytes)
                [IO.File]::Move($temporary, $path, $true)
            } finally {
                if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
            }
        }
        Set-Acl -LiteralPath $path -AclObject $acl
        $saved = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($path))).ToLowerInvariant()
        if ($saved -cne $_.sha256) { throw 'Destination verification failed' }
        [PSCustomObject]@{ name = $_.name; sha256 = $saved; changed = $changed }
    })
    @{ files = $receipts } | ConvertTo-Json -Compress
} catch {
    [Console]::Error.WriteLine('Private-file receiver failed; no private contents are logged.')
    exit 1
}
