---
name: app-design
description: Use when designing or refining an app's interactions, especially desktop keyboard use, discoverable hotkeys, shortcut references, and large search-result lists.
---

# App design defaults

Apply these defaults when choosing a design and when implementing it. For web apps, also apply the [mobile-pwa skill](../mobile-pwa/SKILL.md) for icons, updates, the app shell, and mobile adaptation and verification.

## Desktop keyboard use

Desktop apps of any complexity should generally be fully usable from the keyboard. Cover navigation, search, selection, opening details, editing, saving, cancelling, menus, and dialogs. Use normal Tab navigation and native control behavior, with hotkeys for common actions and appropriate arrow-key navigation within lists and menus. Keep focus visible and restore it sensibly when a dialog or editor closes. Do not require a mouse-only gesture to complete a normal workflow.

Make hotkeys discoverable through visible hints, control titles, or tooltips where appropriate. Provide an easily found keyboard reference on desktop, grouped by context so users can distinguish global commands from list, editor, and dialog commands. Show modifier names or symbols appropriate to the platform. Keep the reference and individual hints consistent with the actual bindings.

Scope hotkeys to the active context. Preserve normal typing and text selection in inputs and editors, and avoid overriding browser or operating-system shortcuts without a deliberate reason. Include a keyboard-only walkthrough of the main workflows in verification. Focus order, escaping a dialog, and returning to the previous control matter as much as whether a handler fires.

Hide desktop hotkey hints and the keyboard reference on mobile layouts. Retain accessible controls and focus behavior; mobile users do not need shortcut labels competing with the content.

## Many search results

Prefer showing all matching results. Do not introduce an arbitrary result cap, numbered pages, or a “Show more” button merely because the list is long. For lightweight items, render the full list first and check it with realistic data. Use measured loading, rendering, or interaction problems to decide when the result set is truly too large to show at once.

When there are too many results, use infinite paging: append batches automatically as the user approaches the end of the scrolling results. Keep every match reachable, preserve the existing results and scroll position while appending, show the full match count when it is known, and reset the visible batch and scroll position when the query or filters change. For server-backed results, include usable loading, error/retry, and end states and prevent duplicate or stale requests. Keyboard scrolling and focus must work through batch boundaries.

Use Word Finder's [ResultsList.tsx](https://github.com/HerbCaudill/word-finder/blob/cb2f684745878d458d553577b1d1aeaf00f88bc2/src/components/ResultsList.tsx) as the concrete pattern for local results. It begins with 500 items and appends 500 more when an `IntersectionObserver` sentinel comes within 500px of the bottom of the results' own scroll container. It keeps the complete matching array and resets the visible count and scroll position when results change. Its [app header](https://github.com/HerbCaudill/word-finder/blob/cb2f684745878d458d553577b1d1aeaf00f88bc2/src/App.tsx) reports the full match count. Those batch and preload sizes are tuning choices, not universal limits.
