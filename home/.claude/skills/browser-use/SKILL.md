---
name: browser-use
description: "Use for browser tasks, authenticated Chrome, connection recovery, bulk extraction, and tab cleanup. Prefer connectors or APIs to clicking."
---

# Browser use

Find the cheapest reliable path, recover browser access before giving up, and leave the browser clean when finished.

## Chrome connection recovery

When a task depends on the user's authenticated Chrome session and the first connection attempt fails:

1. Follow the Chrome-control troubleshooting guidance and run its supported diagnostics.
2. If Chrome is not running, launch it when authorized and retry.
3. If Chrome is running but no live browser route is available, open a fresh window for the selected Chrome profile, wait briefly, and retry when the task's side-effect limits permit it.
4. Report a coverage gap after the permitted recovery attempt fails or no recovery fits the task's limits. State which checks and recovery steps were attempted.

Do not treat an installed extension, a running Chrome process, or a listening debugging port as proof that browser control works. Verify the intended profile's existing account tab with one lightweight read-only renderer call, without activating it when activation could change read state. Distinguish missing tools, connection failure, an unresponsive renderer, a signed-out page, and stalled application sync. Renderer access alone does not establish sign-in, freshness, or complete data.

Opening, activating, reloading, or recovering a messaging page can trigger read receipts, badge changes, or other writes without an explicit click. Honor strict no-write or no-mark-read limits during recovery too. If no permitted recovery path is available, report the gap; do not relax the limit to restore access.

## Size gate

Estimate the item count from the UI.

- Fewer than 20 items: manual work may be faster.
- 20–50 items: check for a connector, CLI, export, or obvious API. Continue manually if quick recon finds nothing.
- More than 50 items, pagination, “Load more,” or infinite scrolling: inspect the app before proceeding.

Do not spend more time optimizing than the task will save.

## Preferred methods

Use the first viable option:

1. Purpose-built connector, API client, or CLI.
2. Built-in export or bulk action.
3. Data already loaded in page state.
4. The app’s documented or observed HTTP API.
5. Local storage or IndexedDB, when it holds usable data and can be read without side effects.
6. DOM extraction.
7. Predictable URLs.
8. Keyboard shortcuts or programmatic form filling.
9. Batched UI actions as a fallback.

Prefer the user’s authenticated Chrome session when browser UI is necessary.

## Recurring browser reads

For recurring reads, use the browser to discover a reliable data-access method. Check connectors and exports first, then loaded page state and observed network requests. When useful responses are available, record a representative session, derive a small client from the observed requests, and verify its results against the browser before reusing it. HAR replay is one possible outcome; it is not a requirement.

For end-to-end encrypted messaging, inspect decrypted page state or the app's local read accessors rather than assuming traffic contains readable messages. Persisted records may also be encrypted, and loaded messages may cover only part of the local history. Do not invoke accessors that send receipts, fetch remote history, or change account state unless the task permits those effects.

Before relying on an adapter, verify its response shape, pagination or sync-token behavior, required secondary folders, date-range coverage, freshness, and read-state effects. A successful request or a complete local cache does not prove complete account history. Keep request rates low, respect rate limits, and report unverified coverage as incomplete.

Reuse live session auth through the supported connection, without hardcoding or logging credentials. Keep HAR files and other credential-bearing captures in private temporary storage outside every repository; delete them when finished, including on failure. Record sanitized request shapes and auth-refresh instructions instead of retaining captures as documentation. Do not capture login flows unnecessarily.

Treat internal clients as maintained adapters. Detect expired auth, changed request or response schemas, stalled sync, and partial results. Stop and report the specific failure instead of returning an empty result as if the source had no activity. Validate prototypes separately before replacing a production reader, and honor any approval limits in the task.

## Website sign-in with 1Password

Use the 1Password browser extension for website logins. Reuse an existing signed-in session first. Do not retrieve website passwords with the `op` CLI or another secret-reading tool unless Herb explicitly requests that approach. This preference takes precedence over the general CLI/API preference above for website authentication.

1. Identify the intended website and account from the task context, then inspect the login page in Herb’s normal Chrome profile.
2. Look for 1Password’s matching saved-login suggestion. If it has not appeared, focus the login field or reload once when doing so will not discard work.
3. Use the browser tools to activate the matching suggestion when they expose it. An accessibility message such as “1Password Sign in options are available” does not mean those tools expose the actual button.
4. On macOS, if the browser tools omit the controls, use native Chrome accessibility through the available computer-use tool. In Codex, select Chrome with `cua.getApp("Google Chrome")`, call `getAXState()`, and click the current element identified as the matching 1Password **Sign in** button. Verify the foreground tab’s URL before clicking. Element IDs are temporary; never reuse an ID from an earlier snapshot or hardcode screen coordinates. If the user or another task changes the foreground tab, re-read the state before acting.
5. Return to the browser tools and verify that the intended site and account are signed in. Do not inspect filled password values, capture login request bodies, or copy credentials into tool output.

Use the native accessibility step only for the 1Password interaction, then resume normal browser automation. Ask Herb to participate when an unlock, biometric prompt, unresolved account choice, or tool restriction prevents completion. Do not ask for login permission again when the current task already authorizes it, unless a higher-priority rule requires confirmation.

Verified on 2026-09-25: Codex’s Chrome tab accessibility tree and screenshot omitted the 1Password sign-in banner on example.devresults.com, while native macOS Chrome accessibility exposed its named button. Clicking that button completed sign-in. Chrome restricts debugger access to another extension’s `chrome-extension://` documents, so do not assume a Playwright frame selector can reach the banner. Do not weaken browser isolation or 1Password protections to make it accessible. If a supported 1Password browser-login integration becomes available to the current agent, prefer it over this UI fallback.

## Recon

For a large task:

1. Check available connectors and CLIs.
2. Look for export and bulk-action controls.
3. If needed, start network capture before navigation. Refresh an already loaded page only when the task's side-effect limits permit it.
4. Perform one representative permitted action and inspect its requests and side effects. Classify operations by their behavior, not just their HTTP method; some reads use POST.
5. Check page state, storage, and DOM structure.
6. Determine whether the list is paginated, infinite-append, or virtualized.
7. Estimate data volume and choose an extraction and transfer method.

Virtualized lists replace old rows while scrolling. Do not assume the full dataset remains in the DOM.

Stop recon after about ten minutes if the app is strongly protected. Ask the user about export access or another data source, or fall back to manageable batched UI work.

## API use

Reproduce the app’s own request rather than guessing endpoints or credentials.

Start with one canary request. Confirm the response shape, pagination, authorization, and error handling before a bulk request. Preserve filters from the UI.

Paginate sequentially by default. Use modest concurrency only when it materially helps. Respect rate limiting, retry headers, service limits, and partial failures.

Never print tokens, cookies, credentials, or unnecessary personal data.

## Writes

A read task does not authorize writes. Observing automatic writes during recon does not authorize replaying them. Invoke mutation endpoints only when the user asks for changes. Use verified read operations; an HTTP method or a background tab alone does not guarantee read-only behavior.

For authorized bulk writes:

1. Observe one UI mutation and verify its request.
2. Test one harmless or reversible item when practical.
3. Prefer a documented bulk endpoint.
4. Otherwise batch individual requests conservatively.
5. Verify the resulting state independently.

Apply the same authorization and destructive-action rules as any other external write.

## Extraction and processing

Extract raw data once, transfer it through an available approved mechanism, and process it outside the browser. Prefer a downloaded CSV or JSON file for large datasets.

If a browser tool blocks output containing personal data, use an approved export or ask the user for another route. Do not weaken, evade, or disguise a safety control.

Use DOM scraping only when the needed data is rendered and no cleaner source exists. For infinite-append lists, load all rows before extraction. For virtualized lists, capture each page during the first pass or use another source.

Keep transformed data separate from raw exports so the result can be checked and reproduced.

## Reuse

When a task will recur, record only durable, non-secret facts in an appropriate project note:

- the connector, export, or endpoint that worked;
- pagination or virtualization behavior;
- required non-secret parameters; and
- rate limits or operational quirks.

Never store session tokens, cookies, or personal data as breadcrumbs.

## Cleanup

Track every browser tab you open. When the browser work is finished, close those tabs unless the user asked to keep one open or the tab is a required deliverable or handoff.

Never close tabs that were already open, including user-owned tabs you claimed temporarily. If a browser disconnection prevents cleanup, report which agent-opened tabs may remain.
