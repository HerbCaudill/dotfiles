import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { readFile, writeFile, mkdir, symlink, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { setTimeout } from "node:timers/promises"
import { isClientPath } from "./captureClientEdits.ts"
import { readWatchFrame } from "./readWatchFrame.ts"
import { publishClientBuild } from "./publishClientBuild.ts"

// Runs only inside a freshly claimed, private session prepared by watchEnvironmentClient.
const session = dirname(process.argv[2])
const manifest = JSON.parse(await readFile(process.argv[2], "utf8"))
const workspace = join(session, "workspace")
const app = join(workspace, "DevResults")
let watcher: { close(): Promise<void> } | undefined
let stopping = false
let lastHeartbeat = Date.now()
let digest = ""
let buildDigest = ""
let failed = false
let publishing = Promise.resolve()
const originals = new Map<string, Buffer | null>()
let previous: Record<string, string | null> = {}

/** Terminate only this foreground session; an SSH disconnect cannot leave an indefinite watcher. */
const stop = () => {
  stopping = true
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
process.stdin.resume()
process.stdin.on("end", stop)

try {
  await mkdir(workspace)
  execFileSync("git", [
    "-C",
    manifest.paths.windows,
    "archive",
    "--format=tar",
    `--output=${join(session, "source.tar")}`,
    manifest.revision,
  ])
  execFileSync("tar.exe", ["-xf", join(session, "source.tar"), "-C", workspace])
  for (const relative of ["node_modules", "DevResults/node_modules"])
    await symlink(join(manifest.paths.windows, relative), join(workspace, relative), "junction")
  process.chdir(app)
  const require = createRequire(join(app, "package.json"))
  const { build } = await import(pathToFileURL(require.resolve("vite")).href)
  console.log("Client watch ready; waiting for frontend edits")
  while (!stopping && Date.now() - lastHeartbeat < 45_000) {
    const frame = await readWatchFrame(join(session, "frame.json"))
    if (!frame) {
      await setTimeout(250)
      continue
    }
    if (frame.stop) break
    lastHeartbeat = frame.heartbeat
    if (frame.digest !== digest) {
      for (const path of new Set([...Object.keys(previous), ...Object.keys(frame.files)])) {
        if (!isClientPath(path)) throw new Error("Refusing a non-frontend watch input")
        if (Object.hasOwn(previous, path) && previous[path] === frame.files[path]) continue
        const full = join(workspace, path)
        if (!originals.has(path)) {
          try {
            originals.set(path, await readFile(full))
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
            originals.set(path, null)
          }
        }
        const content = Object.hasOwn(frame.files, path)
          ? frame.files[path] === null
            ? null
            : Buffer.from(frame.files[path], "base64")
          : originals.get(path)
        if (content == null) await rm(full, { force: true })
        else {
          await mkdir(dirname(full), { recursive: true })
          await writeFile(full, content)
        }
      }
      previous = frame.files
      digest = frame.digest
    }
    if (!watcher) {
      watcher = await build({
        configFile: join(app, "vite.config.ts"),
        mode: "development",
        logLevel: "warn",
        build: { watch: { buildDelay: 250 }, reportCompressedSize: false },
      })
      ;(watcher as any).on("event", (event: any) => {
        if (event.code === "START") {
          buildDigest = digest
          failed = false
        }
        if (event.code === "ERROR") {
          failed = true
          console.error(event.error?.message ?? "Client build failed")
        }
        if (event.code === "END" && !failed && buildDigest === digest) {
          const completed = buildDigest
          publishing = publishing
            .then(async () => {
              await publishClientBuild(
                join(app, "Web/dist"),
                join(manifest.paths.runtime, "web/Web/dist"),
              )
              console.log(`Published client ${completed.slice(0, 12)}; refresh the browser`)
              await writeFile(
                join(session, "published.json"),
                JSON.stringify({ digest: completed, publishedAt: new Date().toISOString() }),
              )
            })
            .catch(error => {
              console.error(error.message)
              stopping = true
            })
        }
      })
    }
    await setTimeout(250)
  }
} finally {
  await watcher?.close()
  await publishing
  process.chdir(session)
  await rm(workspace, { recursive: true, force: true })
  await rm(join(session, "source.tar"), { force: true })
  console.log("Client watch stopped; IIS and the last published client remain available")
  process.stdin.destroy()
}
