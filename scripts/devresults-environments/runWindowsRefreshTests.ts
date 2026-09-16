import { readFile } from "node:fs/promises"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"

const [provision, refresh, tests, supervisor, lifecycle] = await Promise.all(
  ["provision.ps1", "refresh.ps1", "refresh.tests.ps1", "supervisor.ps1", "lifecycle.ps1"].map(
    name => readFile(new URL(`./windows/${name}`, import.meta.url), "utf8"),
  ),
)
const result = await runWindowsAssetPayload(
  "foreach($source in @($r.supervisor,$r.lifecycle,$r.refresh)){$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Maintenance PowerShell parse failed'}}; . ([ScriptBlock]::Create($r.helpers)); . ([ScriptBlock]::Create($r.refresh)); & ([ScriptBlock]::Create($r.tests))",
  {
    helpers: provision.slice(0, provision.indexOf("if ($null -eq $Request)")),
    refresh,
    tests,
    supervisor,
    lifecycle,
  },
  { timeoutMs: 60_000 },
)
console.log(result.stdout.trim())
