import { test, expect } from "@playwright/test"

test("displays hello world", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Hello, world" })).toBeVisible()
})
