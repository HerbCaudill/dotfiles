#!/usr/bin/env -S node --experimental-strip-types

import { createEnvironmentLifecycle } from "./createEnvironmentLifecycle.ts"
import { getRegistryOptions } from "./getRegistryOptions.ts"
import { parseDrenvArgs } from "./parseDrenvArgs.ts"
import { join } from "node:path"
import {
  submitNativeRequest,
  waitNativeRequest,
  inspectNativeRequest,
} from "./submitNativeRequest.ts"
import { runDrenvCommand } from "./runDrenvCommand.ts"
import { encodeWindowsScript } from "./encodeWindowsScript.ts"
import { readFile } from "node:fs/promises"
import { getDrenvHelp } from "./getDrenvHelp.ts"

try {
  const argv = process.argv.slice(2)
  const args = parseDrenvArgs(argv)
  const options = getRegistryOptions(args.host)
  if (args.command === "help") {
    console.log(getDrenvHelp())
    process.exit(0)
  }
  let result
  if (options.windowsHost === "mini" && process.platform !== "win32") {
    const payload = Buffer.from(JSON.stringify(argv)).toString("base64")
    const script = `$a=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json;$env:DRENV_JSON_RESPONSE='1';$env:Path="$env:USERPROFILE\\AppData\\Local\\mise\\shims;$env:USERPROFILE\\AppData\\Local\\mise\\bin;"+$env:Path;& mise exec node@24 -- node --experimental-strip-types C:\\Code\\HerbCaudill\\dotfiles\\scripts\\devresults-environments\\drenv.ts @a;exit $LASTEXITCODE`
    const remote = await runDrenvCommand({
      executable: "ssh",
      args: [
        "-n",
        "mini",
        "powershell.exe",
        "-NoProfile",
        "-EncodedCommand",
        encodeWindowsScript(script),
      ],
      timeoutMs: 8_000_000,
      onRequest: id => console.error(`drenv --host mini request ${id}`),
    })
    const response = JSON.parse(remote.stdout.trim())
    if (!response.ok) throw new Error(response.error)
    result = response.value
    if (args.command === "open")
      for (const url of [result.legacy, result.vibe].filter(Boolean))
        await runDrenvCommand({ executable: "open", args: ["-a", "Google Chrome", url] })
  } else if (options.sourceMode) {
    const directory = join(options.directory, "requests")
    if (args.command === "request") result = await inspectNativeRequest(directory, args.id!)
    else {
      const owner = JSON.parse(await readFile(join(options.windowsRoot, "mini-host.json"), "utf8"))
      if (owner.kind !== "drenv-mini" || owner.version !== 1)
        throw new Error("Install the owned mini controller first")
      const controller = JSON.parse(
        await readFile(join(options.directory, "controller-state.json"), "utf8"),
      )
      if (
        !Number.isFinite(Date.parse(controller.updatedAt)) ||
        Date.now() - Date.parse(controller.updatedAt) > 15_000
      )
        throw new Error(
          "The drenv mini controller is not responding; inspect its scheduled task and controller.log",
        )
      const id = await submitNativeRequest(directory, argv)
      console.error(`drenv request ${id}; receipts: ${directory}`)
      result = await waitNativeRequest(directory, id)
    }
  } else result = await createEnvironmentLifecycle(options)(args)
  console.log(
    process.env.DRENV_JSON_RESPONSE === "1"
      ? JSON.stringify({ ok: true, value: result })
      : typeof result === "string"
        ? result
        : JSON.stringify(result, null, 2),
  )
} catch (error) {
  const message = error instanceof Error ? error.message : "Environment operation failed"
  if (process.env.DRENV_JSON_RESPONSE === "1")
    console.log(JSON.stringify({ ok: false, error: message }))
  else {
    console.error(message)
    process.exitCode = 1
  }
}
