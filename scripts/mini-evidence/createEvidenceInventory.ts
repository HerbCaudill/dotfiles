import { createHash } from "node:crypto"
import { once } from "node:events"
import { constants, createWriteStream } from "node:fs"
import { lstat, open, readdir, readlink, realpath, rename } from "node:fs/promises"
import { isAbsolute, join, relative, resolve, sep } from "node:path"

/** Save a complete content inventory without following links or replacing an earlier inventory. */
export async function createEvidenceInventory(
  /** Evidence tree to inspect. */
  source: string,
  /** New inventory outside that tree; failures preserve its partial file. */
  destination: string,
) {
  const root = await realpath(source)
  const output = resolve(destination)
  const location = relative(root, output)
  if (!location || (!location.startsWith(".." + sep) && location !== ".." && !isAbsolute(location)))
    throw new Error("Inventory must be outside the evidence tree")
  await lstat(output).then(
    () => {
      throw new Error("Inventory already exists")
    },
    error => {
      if (error.code !== "ENOENT") throw error
    },
  )
  const partial = output + ".partial"
  const writer = createWriteStream(partial, { flags: "wx", mode: 0o600 })
  await once(writer, "open")
  const summary = { files: 0, bytes: 0, directories: 0, symlinks: 0, special: 0 }
  /** Write one unambiguous filename/metadata record, respecting backpressure. */
  async function emit(record: Record<string, unknown>) {
    if (!writer.write(JSON.stringify(record) + "\n")) await once(writer, "drain")
  }
  /** Hash a batch with bounded file descriptors, then serialize its records. */
  async function flush(paths: string[]) {
    const records = await Promise.all(paths.map(inspect))
    for (const record of records) {
      if (record.kind === "file") {
        summary.files++
        summary.bytes += record.size
      } else if (record.kind === "directory") summary.directories++
      else if (record.kind === "symlink") summary.symlinks++
      else summary.special++
      await emit(record)
    }
  }
  try {
    await emit({ kind: "start", root, startedAt: new Date().toISOString() })
    let batch: string[] = []
    for await (const path of walk(root)) {
      batch.push(path)
      if (batch.length === 8) {
        await flush(batch)
        batch = []
      }
    }
    await flush(batch)
    await emit({ kind: "summary", ...summary, finishedAt: new Date().toISOString() })
    const finished = once(writer, "finish")
    writer.end()
    await finished
    await rename(partial, output)
    return summary
  } catch (error) {
    writer.destroy()
    throw error
  }

  /** Record link targets without opening them; reject files changed while hashing. */
  async function inspect(path: string) {
    const name = relative(root, path).split(sep).join("/")
    const metadata = await lstat(path, { bigint: true })
    if (metadata.isSymbolicLink())
      return { kind: "symlink" as const, path: name, target: await readlink(path) }
    if (metadata.isDirectory()) return { kind: "directory" as const, path: name }
    if (!metadata.isFile())
      return { kind: "special" as const, path: name, mode: Number(metadata.mode) }
    const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    try {
      const opened = await file.stat({ bigint: true })
      if (opened.ino !== metadata.ino || opened.dev !== metadata.dev)
        throw new Error(`File replaced before hashing: ${name}`)
      const hash = createHash("sha256")
      for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk)
      const current = await lstat(path, { bigint: true })
      if (
        current.ino !== opened.ino ||
        current.size !== opened.size ||
        current.mtimeNs !== opened.mtimeNs
      )
        throw new Error(`File changed while hashing: ${name}`)
      return {
        kind: "file" as const,
        path: name,
        size: Number(opened.size),
        mtimeNs: opened.mtimeNs.toString(),
        sha256: hash.digest("hex"),
      }
    } finally {
      await file.close()
    }
  }
}

/** Enumerate hidden entries and empty directories without descending into links. */
async function* walk(
  /** Current directory inside the source tree. */
  directory: string,
): AsyncGenerator<string> {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    yield path
    if (entry.isDirectory()) yield* walk(path)
  }
}

if (import.meta.main) {
  const [source, destination] = process.argv.slice(2)
  if (!source || !destination) throw new Error("Expected source and new inventory paths")
  console.log(JSON.stringify(await createEvidenceInventory(source, destination)))
}
