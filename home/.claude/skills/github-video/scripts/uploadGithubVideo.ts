import { extname } from "node:path"

/** Upload one video to GitHub's repository-scoped user attachment store. */
export async function uploadGithubVideo(
  /** The authenticated upload request. */
  input: UploadGithubVideoInput,
  /** Side-effecting collaborators used by the upload. */
  dependencies: UploadGithubVideoDependencies,
): Promise<string> {
  const extension = extname(input.fileName).toLowerCase()
  const contentType = VIDEO_CONTENT_TYPES[extension]
  if (!contentType) throw new Error(`Unsupported video type: ${extension || "no extension"}`)
  if (input.bytes.byteLength > MAX_VIDEO_BYTES) {
    throw new Error("Video exceeds GitHub's 100 MB attachment limit")
  }

  const url = new URL("https://uploads.github.com/user-attachments/assets")
  url.search = new URLSearchParams({
    name: input.fileName,
    content_type: contentType,
    repository_id: input.repositoryId,
  }).toString()

  const response = await dependencies.request(url, {
    // Node's fetch accepts Uint8Array bodies although the shared DOM type omits them.
    body: input.bytes as unknown as BodyInit,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/octet-stream",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: "POST",
  })
  const responseBody = await response.text()
  if (!response.ok) {
    throw new Error(`GitHub video upload failed (${response.status}): ${responseBody}`)
  }

  const payload = JSON.parse(responseBody) as UploadResponse
  const uploadedUrl = payload.url ?? payload.href ?? payload.asset?.href
  if (!uploadedUrl) throw new Error("GitHub video upload returned no attachment URL")
  return uploadedUrl
}

const VIDEO_CONTENT_TYPES: Partial<Record<string, string>> = {
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
}

const MAX_VIDEO_BYTES = 100 * 1024 * 1024

type UploadGithubVideoInput = {
  /** Complete video contents. */
  bytes: Uint8Array
  /** Video basename including its extension. */
  fileName: string
  /** Numeric GitHub repository ID. */
  repositoryId: string
  /** GitHub API token. */
  token: string
}

type UploadGithubVideoDependencies = {
  /** Make the GitHub attachment request. */
  request: typeof fetch
}

type UploadResponse = {
  /** Attachment object used by some endpoint versions. */
  asset?: { href?: string }
  /** Attachment URL used by some endpoint versions. */
  href?: string
  /** Current attachment URL response field. */
  url?: string
}
