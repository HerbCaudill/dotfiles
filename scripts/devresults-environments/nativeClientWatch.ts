import { createRequire } from "node:module"
import { readFile, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"
import { publishClientBuild } from "./publishClientBuild.ts"

const requestPath = process.argv[2]
const request = JSON.parse(await readFile(requestPath, "utf8"))
const manifest = request.manifest
const source = join(manifest.paths.windows, "DevResults")
const target = join(manifest.paths.runtime, "web", "Web", "dist")
const owner = JSON.parse(await readFile(join(manifest.paths.runtime, "owner.json"), "utf8"))
if (owner.environmentId !== manifest.id || owner.ownerToken !== manifest.ownerToken)
  throw new Error("Foreign client deployment")
process.chdir(source)
const require = createRequire(join(source, "package.json"))
const vite = await import(pathToFileURL(require.resolve("vite")).href)
const watcher = await vite.build({ build: { watch: {} } })
if (!watcher || !("on" in watcher)) throw new Error("Vite did not create a watcher")
let publishing = Promise.resolve()
watcher.on("event", (event: { code: string; result?: { close(): Promise<void> } }) => {
  if (event.code === "BUNDLE_END") {
    publishing = publishing
      .then(async () => {
        await publishClientBuild(join(source, "Web", "dist"), target)
        await event.result?.close()
        await writeFile(
          join(dirname(requestPath), "ready.json"),
          JSON.stringify({
            ownerToken: manifest.ownerToken,
            publishedAt: new Date().toISOString(),
          }),
        )
        console.log(`Published client ${new Date().toISOString()}`)
      })
      .catch(() => {
        console.error("Client publication failed; previous deployment retained")
        process.exit(1)
      })
  }
})
