import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { privateDirectory } from "./privateDirectory.ts"
import { getWindowsCli } from "./getWindowsCli.ts"

/** Compile only the transport CLI outside its immutable release, without runtime dependencies. */
export async function prepareWindowsCli(
  /** Managed installation root. */
  root: string,
  /** Reviewed source release. */
  release: { path: string; revision: string },
): Promise<string> {
  const parent = join(root, "cli")
  await mkdir(parent, { recursive: true, mode: 0o700 })
  await privateDirectory(parent)
  const destination = join(parent, release.revision)
  if (
    await readFile(join(destination, "manifest.json")).then(
      () => true,
      error => {
        if (error.code !== "ENOENT") throw error
        return false
      },
    )
  )
    return getWindowsCli(root, release.revision)
  const staging = join(parent, `.prepare-${randomUUID()}`)
  await mkdir(staging, { mode: 0o700 })
  await privateDirectory(staging)
  const require = createRequire(await realpath(join(release.path, "node_modules/tsx/package.json")))
  const { build } = require("esbuild")
  const result = await build({
    absWorkingDir: release.path,
    entryPoints: ["src/agent/cli/main.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    packages: "external",
    write: false,
    metafile: true,
  })
  const outputs = result.metafile.outputs as Record<string, { imports: { path: string }[] }>
  if (
    Object.values(outputs).some(output =>
      output.imports.some(item => !item.path.startsWith("node:")),
    )
  )
    throw new Error("The Windows CLI must not require external packages")
  const source = result.outputFiles[0].contents
  await writeFile(join(staging, "main.mjs"), source, { mode: 0o600 })
  await writeFile(
    join(staging, "manifest.json"),
    JSON.stringify({
      version: 1,
      revision: release.revision,
      sha256: createHash("sha256").update(source).digest("hex"),
    }),
    { mode: 0o600 },
  )
  await rename(staging, destination)
  return getWindowsCli(root, release.revision)
}
