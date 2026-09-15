import { readFile } from "node:fs/promises"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import { encodeWindowsScript } from "./encodeWindowsScript.ts"

const [provision, tests, schema] = await Promise.all(
  ["provision.ps1", "schema.tests.ps1", "SchemaProbe.cs"].map(name =>
    readFile(new URL(`./windows/${name}`, import.meta.url), "utf8"),
  ),
)
const result = await runWindowsAssetPayload(
  ". ([ScriptBlock]::Create($r.helpers)); & ([ScriptBlock]::Create($r.tests)) -Assets $r.assets",
  {
    helpers: provision.slice(0, provision.indexOf("if ($null -eq $Request)")),
    tests,
    assets: { schema },
  },
  { timeoutMs: 180_000 },
)
const records = result.stdout
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map(line => JSON.parse(line))
const cleanup = records.find(record => record.cleanup)?.cleanup
if (
  typeof cleanup === "string" &&
  /^C:\\Users\\herbcaudill\\AppData\\Local\\Temp\\drenv-schema-proof-[a-f0-9]{32}$/.test(cleanup)
) {
  const encoded = Buffer.from(cleanup).toString("base64")
  await runDrenvCommand({
    executable: "ssh",
    args: [
      "-n",
      "devresults-vm",
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodeWindowsScript(
        `$path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); Remove-Item -LiteralPath $path -Recurse -Force`,
      ),
    ],
  })
}
console.log(JSON.stringify(records.filter(record => !record.cleanup)))

if (records.some(record => record.failed)) process.exitCode = 1
