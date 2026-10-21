$ErrorActionPreference = 'Stop'
$item = Get-Item -LiteralPath $env:GWS_CREDENTIAL_FILE -Force
if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { exit 1 }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$acl = Get-Acl -LiteralPath $env:GWS_CREDENTIAL_FILE
if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid -or -not $acl.AreAccessRulesProtected) { exit 1 }
$rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
$allowed = @($sid, 'S-1-5-18', 'S-1-5-32-544')
if (-not ($rules | Where-Object { $_.IdentityReference.Value -eq $sid -and $_.AccessControlType -eq 'Allow' })) { exit 1 }
foreach ($rule in $rules) {
  if ($rule.IdentityReference.Value -notin $allowed -or $rule.AccessControlType -ne 'Allow') { exit 1 }
}
exit 0
