import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { setTimeout } from "node:timers/promises"
import { captureClientEdits } from "./captureClientEdits.ts"
import { runWindowsAssetPayload } from "./runWindowsAssetPayload.ts"
import type { EnvironmentManifest } from "./types.ts"

/** Run a foreground frontend-only loop without changing the paired checkout or restarting IIS. */
export async function watchEnvironmentClient(manifest: EnvironmentManifest) {
  if (manifest.phase !== "running" || !manifest.revision)
    throw new Error("Start a fully synced environment before running drenv watch")
  const receipt = JSON.parse(
    await readFile(`${manifest.paths.mac}.drenv-source/owner.json`, "utf8"),
  )
  if (
    receipt.environmentId !== manifest.id ||
    receipt.ownerToken !== manifest.ownerToken ||
    receipt.path !== manifest.paths.mac ||
    (await realpath(manifest.paths.mac)) !== manifest.paths.mac
  )
    throw new Error("Mac source ownership differs from the environment")
  let frame = await captureClientEdits(manifest.paths.mac, manifest.revision)
  const provision = await readFile(new URL("./windows/provision.ps1", import.meta.url), "utf8")
  const helpers = provision.slice(0, provision.indexOf("if ($null -eq $Request)"))
  const assets: Record<string, string> = {}
  for (const path of [
    "clientWatchWorker.ts",
    "readWatchFrame.ts",
    "captureClientEdits.ts",
    "publishClientBuild.ts",
    "runDrenvCommand.ts",
  ])
    assets[path.split("/").at(-1)!] = await readFile(new URL(path, import.meta.url), "utf8")
  const prepared = await runWindowsAssetPayload(
    `
    . ([ScriptBlock]::Create($r.helpers))
    Assert-OwnedSource $r.manifest
    Assert-NoReparse $r.manifest.paths.runtime
    Assert-Owner (Get-Json (Join-Path $r.manifest.paths.runtime 'owner.json')) $r.manifest
    $session=Join-Path "$($r.manifest.paths.windows).drenv-source" $r.session
    [void](New-Item -ItemType Directory -Path $session)
    $utf8=[Text.UTF8Encoding]::new($false)
    foreach($asset in $r.assets.PSObject.Properties){[IO.File]::WriteAllText((Join-Path $session $asset.Name),$asset.Value,$utf8)}
    [IO.File]::WriteAllText((Join-Path $session 'manifest.json'),($r.manifest | ConvertTo-Json -Depth 20),$utf8)
    [IO.File]::WriteAllText((Join-Path $session 'frame.json'),($r.frame | ConvertTo-Json -Depth 20 -Compress),$utf8)
    @{session=$session;node=(Get-Command node.exe).Source} | ConvertTo-Json -Compress
  `,
    {
      manifest,
      helpers,
      assets,
      session: `client-watch-${randomUUID()}`,
      frame: { ...frame, heartbeat: Date.now() },
    },
  )
  const remote = JSON.parse(prepared.stdout.trim())
  for (const path of [remote.session, remote.node])
    if (!/^[A-Za-z]:\\[A-Za-z0-9_\\ .-]+$/.test(path)) throw new Error("Invalid Windows watch path")
  const child = spawn(
    "ssh",
    [
      "-T",
      manifest.windowsHost,
      `& '${remote.node}' --experimental-strip-types '${remote.session}\\clientWatchWorker.ts' '${remote.session}\\manifest.json'`,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  )
  let stopped = false
  let childError: Error | undefined
  const exited = new Promise<void>(resolve => {
    child.on("error", error => {
      childError = error
      stopped = true
      resolve()
    })
    child.on("exit", code => {
      if (code && !stopped) childError = new Error(`Windows client watcher exited (${code})`)
      stopped = true
      resolve()
    })
  })
  const stop = () => {
    stopped = true
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
  try {
    console.log(
      `Watching ${manifest.paths.mac}; save frontend files, then refresh after Published client. Ctrl+C stops watch, not IIS.`,
    )
    while (!stopped) {
      frame = await captureClientEdits(manifest.paths.mac, manifest.revision)
      await send({ ...frame, heartbeat: Date.now() })
      await setTimeout(1500)
    }
  } finally {
    try {
      await send({ stop: true })
    } finally {
      child.stdin.end()
      await Promise.race([exited, setTimeout(50_000, undefined, { ref: false })])
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
      process.removeListener("SIGINT", stop)
      process.removeListener("SIGTERM", stop)
    }
  }
  if (childError) throw childError
  return { environmentId: manifest.id, status: "watch-stopped", runtime: "running" }

  /** Atomically replace a complete edit snapshot and renew the remote session lease. */
  async function send(value: unknown) {
    await runWindowsAssetPayload(
      `
      $utf8=[Text.UTF8Encoding]::new($false)
      $path=Join-Path $r.session 'frame.json'
      [IO.File]::WriteAllText(($path+'.next'),($r.frame | ConvertTo-Json -Depth 30 -Compress),$utf8)
      [IO.File]::Replace(($path+'.next'),$path,($path+'.previous'))
      [IO.File]::Delete(($path+'.previous'))
    `,
      { session: remote.session, frame: value },
      { timeoutMs: 20_000 },
    )
  }
}
