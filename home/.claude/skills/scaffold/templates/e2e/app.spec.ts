import { test, expect } from "@playwright/test"

test("displays hello message", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible()
})

test("keeps the header still while long content scrolls", async ({ page }) => {
  await page.goto("/")
  const header = page.getByRole("banner")
  const content = page.getByRole("main")
  await expect(header).toBeVisible()
  const before = await header.boundingBox()
  await content.evaluate(element => {
    // Exercise the shell before the starter app has enough real content to scroll.
    const fixture = document.createElement("div")
    fixture.style.height = "2000px"
    fixture.textContent = "Long content for the app shell check"
    element.append(fixture)
    element.scrollTop = 1000
  })
  expect(await content.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  const after = await header.boundingBox()
  expect(after!.y).toBeCloseTo(before!.y, 0)
  expect(after!.width).toBeCloseTo(page.viewportSize()!.width, 0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})
