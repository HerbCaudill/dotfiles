import { randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout } from "node:timers/promises"
import { withRegistryLock } from "./withRegistryLock.ts"

/** Attach identical callers to one active durable request, otherwise publish a fresh request. */
export async function submitNativeRequest(directory: string, args: string[]) {
  await mkdir(directory, { recursive: true })
  return withRegistryLock(join(directory, "submission"), async () => {
    for (const name of await readdir(directory)) {
      if (!/^[a-f0-9-]{36}$/.test(name)) continue
      const request = JSON.parse(await readFile(join(directory, name, "request.json"), "utf8"))
      const result = await readResult(join(directory, name))
      if (!result && JSON.stringify(request.args) === JSON.stringify(args)) return name
    }
    const id = randomUUID()
    const path = join(directory, id)
    await mkdir(path)
    await writeFile(
      join(path, "request.tmp"),
      JSON.stringify({ id, args, createdAt: new Date().toISOString() }),
      { flag: "wx" },
    )
    await rename(join(path, "request.tmp"), join(path, "request.json"))
    return id
  })
}

/** Wait for a durable result; caller termination leaves the scheduled operation untouched. */
export async function waitNativeRequest(directory: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid request identity")
  for (;;) {
    const result = await readResult(join(directory, id))
    if (result) {
      if (!result.ok) throw new Error(result.error)
      return result.value
    }
    await setTimeout(500)
  }
}

/** Inspect a durable request after the original caller disconnects. */
export async function inspectNativeRequest(directory: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid request identity")
  const path = join(directory, id)
  const request = JSON.parse(await readFile(join(path, "request.json"), "utf8"))
  const result = await readResult(path)
  let worker
  try {
    worker = JSON.parse(await readFile(join(path, "worker.json"), "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  return {
    ...request,
    status: result ? (result.ok ? "completed" : "failed") : worker ? "worker-recorded" : "queued",
    worker,
    result,
  }
}

/** Incomplete writes are never published as completed requests. */
async function readResult(
  path: string,
): Promise<{ ok: boolean; value?: unknown; error?: string } | undefined> {
  try {
    return JSON.parse(await readFile(join(path, "result.json"), "utf8"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
}
