---
name: browser-use
description: "Use for browser work, especially repetitive tasks, authenticated Chrome sessions, connection recovery, and tab cleanup. Prefer connectors, exports, APIs, and scripts to manual clicking."
---

# Browser use

Find the cheapest reliable path, recover browser access before giving up, and leave the browser clean when finished.

## Chrome connection recovery

When a task depends on the user's authenticated Chrome session and the first connection attempt fails:

1. Follow the Chrome-control troubleshooting guidance and run its supported diagnostics.
2. If Chrome is not running, launch it when authorized and retry.
3. If Chrome is running but no live browser route is available, open a fresh window for the selected Chrome profile, wait briefly, and retry.
4. Report a coverage gap only after the supported recovery attempt also fails. State which checks and recovery steps were attempted.

Do not treat an installed extension or a running Chrome process as proof that browser control is connected. Verify the live route by selecting Chrome and making one lightweight read-only call.

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
5. DOM extraction.
6. Local storage or IndexedDB.
7. Predictable URLs.
8. Keyboard shortcuts or programmatic form filling.
9. Batched UI actions as a fallback.

Prefer the user’s authenticated Chrome session when browser UI is necessary.

## Recon

For a large task:

1. Check available connectors and CLIs.
2. Look for export and bulk-action controls.
3. Start network capture before navigation. If the page is already loaded, start capture and refresh.
4. Perform one representative action and inspect its requests.
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

A read task does not authorize writes. Discover or invoke mutation endpoints only when the user asks for changes.

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
