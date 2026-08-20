import { describe, expect, test, vi } from "vitest"

import { uploadGithubVideo } from "../uploadGithubVideo.ts"

describe("uploadGithubVideo", () => {
  test("uploads a WebM to the repository attachment store", async () => {
    const request = vi.fn(
      async (
        /** GitHub attachment endpoint. */ _url: string | URL | Request,
        /** GitHub attachment request options. */ _options?: RequestInit,
      ) =>
        new Response(
          JSON.stringify({ url: "https://github.com/user-attachments/assets/example" }),
          {
            status: 201,
          },
        ),
    )

    const url = await uploadGithubVideo(
      {
        bytes: new Uint8Array([1, 2, 3]),
        fileName: "project index.webm",
        repositoryId: "123",
        token: "secret-token",
      },
      { request },
    )

    expect(url).toBe("https://github.com/user-attachments/assets/example")
    expect(request).toHaveBeenCalledOnce()

    const [requestUrl, options] = request.mock.calls[0]!
    expect(requestUrl.toString()).toBe(
      "https://uploads.github.com/user-attachments/assets?name=project+index.webm&content_type=video%2Fwebm&repository_id=123",
    )
    expect(options).toMatchObject({
      headers: {
        Accept: "application/json",
        Authorization: "Bearer secret-token",
        "Content-Type": "application/octet-stream",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "POST",
    })
  })

  test("rejects unsupported files before making a request", async () => {
    const request = vi.fn()

    await expect(
      uploadGithubVideo(
        {
          bytes: new Uint8Array([1]),
          fileName: "screenshot.png",
          repositoryId: "123",
          token: "secret-token",
        },
        { request },
      ),
    ).rejects.toThrow("Unsupported video type: .png")
    expect(request).not.toHaveBeenCalled()
  })

  test("rejects videos above GitHub's maximum attachment size", async () => {
    const request = vi.fn()
    const oversizedBytes = { byteLength: 100 * 1024 * 1024 + 1 } as Uint8Array

    await expect(
      uploadGithubVideo(
        {
          bytes: oversizedBytes,
          fileName: "demo.webm",
          repositoryId: "123",
          token: "secret-token",
        },
        { request },
      ),
    ).rejects.toThrow("Video exceeds GitHub's 100 MB attachment limit")
    expect(request).not.toHaveBeenCalled()
  })

  test("reports GitHub failures without including the token", async () => {
    const request = vi.fn(async () => new Response("denied", { status: 403 }))

    await expect(
      uploadGithubVideo(
        {
          bytes: new Uint8Array([1]),
          fileName: "demo.mp4",
          repositoryId: "123",
          token: "secret-token",
        },
        { request },
      ),
    ).rejects.toThrow("GitHub video upload failed (403): denied")
    expect(request.mock.calls.join(" ")).not.toContain("secret-token")
  })
})
