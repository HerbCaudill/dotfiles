import { expect, test } from "@playwright/test"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

test("updates one window while another keeps its unsaved work", async ({
  page,
  context,
  baseURL,
}) => {
  // Chrome bypasses request interception when fetching an updated worker.
  let updated = false
  const server = createServer(async (request, response) => {
    try {
      const upstream = await fetch(new URL(request.url!, baseURL))
      response.statusCode = upstream.status
      response.setHeader("Content-Type", upstream.headers.get("content-type") ?? "text/plain")
      const body = Buffer.from(await upstream.arrayBuffer())
      response.end(
        updated && request.url === "/sw.js"
          ? Buffer.concat([body, Buffer.from("\n// New worker version\n")])
          : body,
      )
    } catch {
      response.writeHead(502).end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    await page.goto(origin)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    const other = await context.newPage()
    await other.goto(origin)
    await other.evaluate(() => {
      // Represent an editor's normal leave guard without adding an editor to the starter app.
      Object.assign(window, { updateDraft: "Keep this draft", originalWindow: true })
      window.addEventListener("beforeunload", event => {
        if ((window as Window & { updateDraft?: string }).updateDraft) event.preventDefault()
      })
    })
    updated = true
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration!.update()
    })
    const notice = page.getByRole("complementary", { name: "App update" })
    await expect(notice.getByRole("button", { name: "Update now" })).toBeVisible()
    await page.evaluate(() => Object.assign(window, { originalWindow: true }))
    await Promise.all([
      page.waitForEvent("load"),
      notice.getByRole("button", { name: "Update now" }).click(),
    ])
    expect(await page.evaluate(() => "originalWindow" in window)).toBe(false)
    expect(
      await other.evaluate(() => (window as Window & { updateDraft?: string }).updateDraft),
    ).toBe("Keep this draft")
    expect(await other.evaluate(() => "originalWindow" in window)).toBe(true)
    await other.getByRole("button", { name: "Update now" }).click()
    await expect(other.getByRole("alert")).toHaveText("Finish saving your changes, then try again.")
    await other.evaluate(() => Object.assign(window, { updateDraft: "" }))
    await Promise.all([
      other.waitForEvent("load"),
      other.getByRole("button", { name: "Update now" }).click(),
    ])
    expect(await other.evaluate(() => "originalWindow" in window)).toBe(false)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    )
  }
})
