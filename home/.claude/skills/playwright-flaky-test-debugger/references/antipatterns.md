# Common Playwright Flakiness Patterns and Fixes

## Timing Issues

### Hard-coded timeouts
**Anti-pattern:**
```typescript
await page.waitForTimeout(1000) // Bad: arbitrary wait
await button.click()
```

**Fix:**
```typescript
await page.waitForSelector('button:not([disabled])')
await button.click()
```

### Missing wait conditions
**Anti-pattern:**
```typescript
await page.click('button')
expect(page.locator('.result')).toBeVisible() // May fail if result appears async
```

**Fix:**
```typescript
await page.click('button')
await expect(page.locator('.result')).toBeVisible() // Waits up to timeout
```

### Not waiting for network idle
**Anti-pattern:**
```typescript
await page.goto(url)
await page.click('button') // May click before page fully loaded
```

**Fix:**
```typescript
await page.goto(url, { waitUntil: 'networkidle' })
await page.click('button')
```

## Race Conditions

### Async operations without proper awaits
**Anti-pattern:**
```typescript
page.click('button') // Missing await
await expect(page.locator('.result')).toBeVisible()
```

**Fix:**
```typescript
await page.click('button')
await expect(page.locator('.result')).toBeVisible()
```

### Multiple elements appearing/disappearing
**Anti-pattern:**
```typescript
await page.click('.delete')
expect(page.locator('.item')).toHaveCount(4) // May check before DOM updates
```

**Fix:**
```typescript
await page.click('.delete')
await expect(page.locator('.item')).toHaveCount(4) // Auto-waits for count
```

### Toast/notification timing
**Anti-pattern:**
```typescript
await page.click('save')
await expect(page.locator('.toast')).toBeVisible()
await page.click('next') // Toast may still be visible
```

**Fix:**
```typescript
await page.click('save')
await expect(page.locator('.toast')).toBeVisible()
await expect(page.locator('.toast')).not.toBeVisible() // Wait for toast to disappear
await page.click('next')
```

## Selector Issues

### Brittle CSS selectors
**Anti-pattern:**
```typescript
await page.click('.css-abc123-button') // Generated class names change
```

**Fix:**
```typescript
await page.getByRole('button', { name: 'Submit' }).click() // User-facing selector
// Or use test IDs:
await page.locator('[data-testid="submit-button"]').click()
```

### Ambiguous selectors
**Anti-pattern:**
```typescript
await page.click('button') // Multiple buttons on page
```

**Fix:**
```typescript
await page.getByRole('button', { name: 'Submit' }).click() // Specific button
// Or scope to container:
await page.locator('.dialog').getByRole('button', { name: 'OK' }).click()
```

## Test Isolation

### Shared state between tests
**Anti-pattern:**
```typescript
let page: Page
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage() // Shared page across tests
})

test('test 1', async () => {
  await page.goto('/page1')
  // State persists to next test
})
```

**Fix:**
```typescript
test('test 1', async ({ page }) => {
  await page.goto('/page1')
  // Fresh page context for each test
})
```

### Missing cleanup
**Anti-pattern:**
```typescript
test('test 1', async ({ page }) => {
  await page.goto('/settings')
  await page.fill('[name="setting"]', 'value')
  // Setting persists in localStorage/cookies
})
```

**Fix:**
```typescript
test.afterEach(async ({ page }) => {
  await page.evaluate(() => localStorage.clear())
})
```

### Database state pollution
**Anti-pattern:**
```typescript
test('create user', async ({ page }) => {
  await page.fill('[name="username"]', 'testuser')
  // User persists in DB, causes unique constraint violations
})
```

**Fix:**
```typescript
test.beforeEach(async () => {
  await resetDatabase()
})
// Or use unique identifiers:
await page.fill('[name="username"]', `testuser-${Date.now()}`)
```

## Animation and Transitions

### Clicking during animation
**Anti-pattern:**
```typescript
await page.click('.open-dialog')
await page.click('.dialog button') // May click before animation completes
```

**Fix:**
```typescript
await page.click('.open-dialog')
await expect(page.locator('.dialog')).toBeVisible()
await page.locator('.dialog button').click()
// Or disable animations in test mode:
// In CSS: * { animation-duration: 0s !important; transition-duration: 0s !important; }
```

## Auto-waiting Gotchas

### Using non-Playwright assertions
**Anti-pattern:**
```typescript
const text = await page.locator('.result').textContent()
expect(text).toBe('Success') // No auto-waiting
```

**Fix:**
```typescript
await expect(page.locator('.result')).toHaveText('Success') // Auto-waits
```

### Getting values before they're ready
**Anti-pattern:**
```typescript
await page.click('load')
const count = await page.locator('.items').count() // May count before loading completes
```

**Fix:**
```typescript
await page.click('load')
await expect(page.locator('.items')).toHaveCount(5) // Waits for count to match
```

## Debugging Tips

### Enable trace on first retry
```typescript
// playwright.config.ts
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}
```

### Add debug output
```typescript
test('flaky test', async ({ page }) => {
  await page.on('console', msg => console.log('PAGE LOG:', msg.text()))
  await page.on('pageerror', err => console.log('PAGE ERROR:', err))
})
```

### Check for multiple elements
```typescript
// If clicking the "wrong" button:
const buttons = await page.getByRole('button', { name: 'Submit' }).all()
console.log(`Found ${buttons.length} matching buttons`)
```
