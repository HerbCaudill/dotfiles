$ErrorActionPreference = 'Stop'
$path = $env:AGENT_PRIVATE_DIRECTORY
$item = Get-Item -LiteralPath $path -Force
if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  throw 'Private storage cannot be redirected.'
}
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = Get-Acl -LiteralPath $path
if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) {
  throw 'Private storage must belong to the current user.'
}
$allowed = @($sid.Value, 'S-1-5-18', 'S-1-5-32-544')
$rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
$unexpected = @($rules | Where-Object {
  $_.IdentityReference.Value -notin $allowed -or $_.AccessControlType -ne 'Allow' -or
  $_.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or
  $_.InheritanceFlags -ne ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit) -or
  $_.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None
})
if ($acl.AreAccessRulesProtected -and $rules.Count -eq 3 -and $unexpected.Count -eq 0) { return }
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($rule) }
foreach ($principal in @($sid.Value, 'S-1-5-18', 'S-1-5-32-544')) {
  $identity = New-Object Security.Principal.SecurityIdentifier($principal)
  $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
[IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($path), $acl)
