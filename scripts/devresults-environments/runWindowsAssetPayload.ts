import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { gzipSync } from "node:zlib"
import { encodeWindowsScript } from "./encodeWindowsScript.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"

/** Transfer large trusted assets through SFTP, avoiding intermittent Windows SSH stdin EOF stalls. */
export async function runWindowsAssetPayload(
  /** Trusted versioned consumer; its decoded request is $r. */
  script: string,
  /** Private serialized request and versioned asset fields. */
  request: unknown,
  /** Explicit host and execution limit. */
  options: { host?: string; timeoutMs?: number } = {},
) {
  const host = options.host ?? "devresults-vm"
  if (host !== "devresults-vm") throw new Error("Windows lifecycle requires devresults-vm")
  const name = `drenv-transport-${randomUUID()}`
  const local = await mkdtemp(join(tmpdir(), name))
  /** Run only trusted encoded PowerShell without passing a piped request. */
  const invoke = (source: string, timeoutMs = 30_000) =>
    runDrenvCommand({
      executable: "ssh",
      args: [
        "-n",
        host,
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encodeWindowsScript(source),
      ],
      timeoutMs,
    })
  try {
    const created = await invoke(
      `$ErrorActionPreference='Stop'; $path=Join-Path ([IO.Path]::GetTempPath()) '${name}'; [void](New-Item -ItemType Directory -Path $path); ConvertTo-Json -Compress -InputObject $path`,
    )
    const directory: string = JSON.parse(created.stdout.trim())
    if (!/^[A-Za-z]:\\[A-Za-z0-9_\\ .-]+$/.test(directory) || !directory.endsWith(`\\${name}`))
      throw new Error("Unexpected Windows transport directory")
    const file = join(local, "request.gz")
    await writeFile(file, gzipSync(Buffer.from(JSON.stringify(request))), { mode: 0o600 })
    await runDrenvCommand({
      executable: "scp",
      args: ["--", file, `${host}:${directory.replaceAll("\\", "/")}/request.gz`],
      timeoutMs: 120_000,
    })
    const encodedPath = Buffer.from(directory, "utf8").toString("base64")
    return await invoke(
      `$ErrorActionPreference='Stop'; $directory=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}')); try {$stream=[IO.File]::OpenRead((Join-Path $directory 'request.gz')); $gzip=[IO.Compression.GZipStream]::new($stream,[IO.Compression.CompressionMode]::Decompress);$reader=[IO.StreamReader]::new($gzip);try{$r=$reader.ReadToEnd() | ConvertFrom-Json}finally{$reader.Dispose();$gzip.Dispose();$stream.Dispose()}; ${script}} finally {Remove-Item -LiteralPath $directory -Recurse -Force}`,
      options.timeoutMs ?? 3_600_000,
    )
  } finally {
    await rm(local, { recursive: true, force: true })
  }
}
