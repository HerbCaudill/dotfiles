import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { win32 } from "node:path"
import type { SourceRequest } from "./sourceTypes.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"

/** Upload an immutable bundle to the owned Windows claim and invoke the versioned native source payload. */
export async function transportEnvironmentSource(
  /** Explicit identity, destination and frozen bundle. */
  request: SourceRequest,
): Promise<string> {
  const { manifest } = request
  if (manifest.windowsHost !== "devresults-vm")
    throw new Error("Windows source operations require devresults-vm")
  if (
    !/^[A-Za-z]:\\[A-Za-z0-9_\\ .-]+$/.test(manifest.paths.windows) ||
    win32.normalize(manifest.paths.windows) !== manifest.paths.windows
  )
    throw new Error("Unsafe Windows source path")
  const script = await readFile(new URL("./windows/source.ps1", import.meta.url), "utf8")
  const encoded = Buffer.from(script, "utf16le").toString("base64")
  const upload = `${randomUUID()}.bundle`
  const data = {
    environmentId: manifest.id,
    ownerToken: manifest.ownerToken,
    path: manifest.paths.windows,
    revision: request.revision,
    operation: request.operation,
    ref: request.ref,
    upload,
  }
  /** Run a fixed payload with data transported separately from executable PowerShell. */
  const invoke = async (stage: string) => {
    const result = await runDrenvCommand({
      executable: "ssh",
      args: [
        manifest.windowsHost,
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encoded,
      ],
      input: JSON.stringify({ ...data, stage }),
      timeoutMs: 600_000,
    })
    const response = JSON.parse(result.stdout.trim())
    if (!response.ok) throw new Error(`Windows source prerequisite: ${response.error}`)
    return response
  }
  await invoke("prepare")
  const destination = `${manifest.paths.windows}.drenv-source\\${upload}`.replaceAll("\\", "/")
  // The path alphabet is validated above and modern scp uses SFTP, without a remote command shell.
  await runDrenvCommand({
    executable: "scp",
    args: ["--", request.bundle, `${manifest.windowsHost}:${destination}`],
    timeoutMs: 600_000,
  })
  return (await invoke("apply")).revision
}
