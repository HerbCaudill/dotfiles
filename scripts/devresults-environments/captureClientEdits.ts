import { createHash } from "node:crypto"
import { lstat, readFile, realpath } from "node:fs/promises"
import { join } from "node:path"
import { runDrenvCommand } from "./runDrenvCommand.ts"

/** Capture only frontend edits against the deployed revision, including uncommitted saves. */
export async function captureClientEdits(root: string, baseline: string) {
  if (!/^[a-f0-9]{40}$/.test(baseline)) throw new Error("A verified deployed revision is required")
  const git = async (args: string[]) =>
    (await runDrenvCommand({ executable: "git", args, cwd: root })).stdout
  if ((await realpath(root)).startsWith("/Volumes/")) throw new Error("Use the native Mac checkout")
  const changed = await git(["diff", "--name-only", "-z", baseline, "--"])
  const added = await git(["ls-files", "--others", "--exclude-standard", "-z"])
  const paths = [...new Set((changed + added).split("\0").filter(Boolean))].sort()
  const files: Record<string, string | null> = {}
  for (const path of paths) {
    if (!isClientPath(path))
      throw new Error(`Change requires drenv sync (stop watch first): ${path}`)
    try {
      const full = join(root, path)
      if (!(await lstat(full)).isFile() || (await realpath(full)) !== full)
        throw new Error(`Client input is not a regular native file: ${path}`)
      files[path] = (await readFile(full)).toString("base64")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      files[path] = null
    }
  }
  return { files, digest: createHash("sha256").update(JSON.stringify(files)).digest("hex") }
}

/** Restrict live edits to browser source; dependencies and build configuration require full sync. */
export function isClientPath(path: string) {
  return (
    /^DevResults\/Web\/(Css|Scripts)\/[A-Za-z0-9_./ @()+,-]+\.(ts|tsx|js|json|html|scss|css)$/.test(
      path,
    ) &&
    !path
      .split("/")
      .some(part => part === ".." || part === "." || part === "node_modules" || part === "dist")
  )
}
