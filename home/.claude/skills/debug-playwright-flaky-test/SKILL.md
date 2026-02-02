---
name: debug-playwright-flaky-test
description: Debug intermittently failing Playwright tests. Use when a test passes sometimes but fails other times, or when asked to fix flaky tests, investigate test failures, or debug intermittent test issues.
---

# Playwright Flaky Test Debugger

## Workflow

### 1. Reproduce the failure

Run the test repeatedly to confirm flakiness and capture a failure:

```bash
pnpm test:pw -g "test name or pattern" --repeat-each 100 --max-failures 1
```

This runs the test up to 100 times and stops at the first failure. Adjust `--repeat-each` based on failure frequency (higher for rare flakes).

### 2. Read the test code

Read the failing test file to understand what it's testing and identify the failure point.

### 3. Analyze for anti-patterns

Read `references/antipatterns.md` and check the test code for common flakiness patterns:

- Hard-coded timeouts (`waitForTimeout`)
- Missing wait conditions
- Race conditions with async operations
- Brittle or ambiguous selectors
- Test isolation issues (shared state, missing cleanup)
- Animation/transition timing
- Not using Playwright's auto-waiting assertions

### 4. Check test artifacts

If the test run produced artifacts, examine them:

- Screenshots: Look for unexpected UI states
- Trace files: Review timing and network activity
- Console logs: Check for JavaScript errors or warnings

### 5. Propose fixes

Based on the anti-patterns found, suggest specific code changes to make the test reliable. Explain which pattern was causing the flakiness and why the fix addresses it.

## Common fixes

- Replace `waitForTimeout` with `waitForSelector` or `expect().toBeVisible()`
- Add `await` to async operations
- Use `expect().toHaveText()` instead of comparing `textContent()` values
- Switch to user-facing selectors (`getByRole`, `getByText`) or test IDs
- Wait for animations/transitions to complete before interacting
- Add `beforeEach`/`afterEach` cleanup for state isolation
- Wait for toasts/notifications to disappear before proceeding

## Resources

- `references/antipatterns.md`: Comprehensive list of Playwright flakiness patterns with examples and fixes
