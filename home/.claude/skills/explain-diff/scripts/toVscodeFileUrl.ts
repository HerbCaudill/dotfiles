import path from "node:path"

/** Build a VS Code deep link to a local file and one-based line number. */
export function toVscodeFileUrl(root: string, file: string, line = 1): string {
  const encodedPath = path
    .resolve(root, file)
    .split(path.sep)
    .map(segment => encodeURIComponent(segment))
    .join("/")
  return `vscode://file/${encodedPath}:${line}`
}
