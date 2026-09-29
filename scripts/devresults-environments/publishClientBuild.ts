import { copyFile, lstat, mkdir, readFile, readdir, rename } from "node:fs/promises"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"

/** Publish a complete successful Vite build, switching its manifest last and retaining old hashed assets. */
export async function publishClientBuild(source: string, target: string) {
  const manifestPath = ".vite/manifest.json"
  const manifest = JSON.parse(await readFile(join(source, manifestPath), "utf8"))
  for (const entry of Object.values(manifest) as Array<{
    file: string
    css?: string[]
    assets?: string[]
  }>) {
    for (const path of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
      if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").includes(".."))
        throw new Error("Unsafe Vite manifest asset path")
      if (!(await lstat(join(source, path))).isFile()) throw new Error("Missing Vite asset")
    }
  }
  const paths = await listFiles(source)
  for (const path of paths.filter(path => path !== manifestPath)) await publish(path)
  await publish(manifestPath)

  /** Replace individual files atomically; a failed copy never exposes a partial manifest or asset. */
  async function publish(path: string) {
    const destination = join(target, path)
    await mkdir(dirname(destination), { recursive: true })
    const temporary = `${destination}.${randomUUID()}.tmp`
    await copyFile(join(source, path), temporary)
    await rename(temporary, destination)
  }
}

/** Reject links rather than following files outside the build directory. */
async function listFiles(root: string, prefix = ""): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) throw new Error("Build output contains a symbolic link")
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)))
    else if (entry.isFile()) files.push(path)
  }
  return files
}
