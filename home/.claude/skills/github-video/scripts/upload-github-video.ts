import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"

import { uploadGithubVideo } from "./uploadGithubVideo.ts"

const [filePath, repositoryArgument] = process.argv.slice(2)
if (!filePath) {
  throw new Error("Usage: upload-github-video.ts <video-path> [owner/repository]")
}

const repository =
  repositoryArgument ??
  execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
    encoding: "utf8",
  }).trim()
const repositoryId = execFileSync("gh", ["api", `repos/${repository}`, "--jq", ".id"], {
  encoding: "utf8",
}).trim()
const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim()
const url = await uploadGithubVideo(
  {
    bytes: await readFile(filePath),
    fileName: basename(filePath),
    repositoryId,
    token,
  },
  { request: fetch },
)

console.log(url)
