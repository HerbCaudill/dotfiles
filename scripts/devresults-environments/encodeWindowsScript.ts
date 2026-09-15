import { gzipSync } from "node:zlib"

/** Compress trusted versioned PowerShell into a bounded encoded command, keeping runtime data on stdin. */
export function encodeWindowsScript(
  /** Trusted payload source, never user-supplied command fragments. */
  script: string,
) {
  const compressed = gzipSync(Buffer.from(script, "utf8")).toString("base64")
  const loader = `$ErrorActionPreference='Stop'; $b=[Convert]::FromBase64String('${compressed}'); $m=[IO.MemoryStream]::new($b,0,$b.Length); $g=[IO.Compression.GZipStream]::new($m,[IO.Compression.CompressionMode]::Decompress); $r=[IO.StreamReader]::new($g); try { $s=$r.ReadToEnd() } finally { $r.Dispose(); $g.Dispose(); $m.Dispose() }; & ([ScriptBlock]::Create($s))`
  const encoded = Buffer.from(loader, "utf16le").toString("base64")
  if (encoded.length > 30_000)
    throw new Error("Windows payload exceeds safe command transport size")
  return encoded
}
