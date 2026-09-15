import { readFile } from "node:fs/promises"
import { expect, it } from "vitest"
import { runWindowsAssetPayload } from "../runWindowsAssetPayload.ts"

it.skipIf(process.env.DRENV_WINDOWS_RESERVATION_TEST !== "1")(
  "removes an empty never-paired reservation and refuses a partial Windows source",
  async () => {
    const [provision, lifecycle] = await Promise.all([
      readFile(new URL("../windows/provision.ps1", import.meta.url), "utf8"),
      readFile(new URL("../windows/lifecycle.ps1", import.meta.url), "utf8"),
    ])
    const result = await runWindowsAssetPayload(
      `. ([ScriptBlock]::Create($r.helpers)); $root=Join-Path $env:TEMP ('drenv-reservation-'+[guid]::NewGuid().ToString('N')); $id='reservation-'+[guid]::NewGuid().ToString('N').Substring(0,8); $ports=@(); for($port=39000;$port -lt 40000 -and $ports.Count -lt 5;$port++){if(-not(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)){$ports+=$port}}; $m=[pscustomobject]@{id=$id;ownerToken=[guid]::NewGuid().ToString();catalog=('drenv_'+$id.Replace('-','_'));paths=[pscustomobject]@{windows=(Join-Path $root "source\\$id");runtime=(Join-Path $root "runtime\\$id")};ports=[pscustomobject]@{https=$ports[0];http=$ports[1];blob=$ports[2];queue=$ports[3];table=$ports[4]}}; $request=[pscustomobject]@{manifest=$m;operation='remove'}; try { $empty=(& ([ScriptBlock]::Create($r.lifecycle)) -Request $request) | ConvertFrom-Json; [void][IO.Directory]::CreateDirectory($m.paths.windows); [IO.File]::WriteAllText((Join-Path $m.paths.windows 'preserve.txt'),'partial source evidence'); $partial=(& ([ScriptBlock]::Create($r.lifecycle)) -Request $request) | ConvertFrom-Json; @{empty=$empty;partial=$partial;preserved=[IO.File]::ReadAllText((Join-Path $m.paths.windows 'preserve.txt'))}|ConvertTo-Json -Depth 10 -Compress } finally {if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}}`,
      { helpers: provision.slice(0, provision.indexOf("if ($null -eq $Request)")), lifecycle },
      { timeoutMs: 120_000 },
    )
    const observed = JSON.parse(result.stdout.trim())
    expect(observed.empty.ok).toBe(true)
    expect(observed.empty.status).toBe("removed")
    expect(observed.partial.ok).toBe(false)
    expect(observed.partial.prerequisite).toContain("without a verified source revision")
    expect(observed.preserved).toBe("partial source evidence")
  },
  150_000,
)
