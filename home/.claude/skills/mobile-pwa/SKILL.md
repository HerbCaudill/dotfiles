---
name: mobile-pwa
description: Use when building or refining a responsive web app or PWA, especially icons, update notices, iPhone inputs, zoom prevention, fixed headers, safe areas, and mobile visual verification.
---

# Mobile PWA defaults

Apply these defaults to new apps and preserve them when refining existing apps. The [scaffold](../scaffold/SKILL.md) supplies working Vite/React templates. Other stacks must implement the same outcomes with their own tools. Read [the evidence](references.md) when diagnosing an iOS regression or adapting the update flow.

## Icons from the first build

Every app has a real favicon, an Apple touch icon, and manifest icons from the beginning. The agent creates a simple placeholder appropriate to that particular app's purpose, name, and palette. Use a recognizable motif such as a book for a reading app or a route marker for a travel app; do not reuse one generic placeholder across projects. Never leave `data:,`, Vite's logo, missing icon files, or an iconless manifest.

Supply an SVG favicon, a 180×180 PNG Apple touch icon, 192×192 and 512×512 PNG manifest icons, and a maskable icon with its important shape inside the central safe zone. Link the favicon and Apple icon in HTML, list the PNGs in the manifest, and include them in the offline cache. Keep the icon legible on both light and dark backgrounds. Replace the placeholder across all sizes together.

## Explicit app updates

Use a visible, compact notice in the lower left: “An update is ready.” and an “Update now” button. Keep it inside the viewport and above the bottom safe area on phones. Mount it once at the app root so onboarding, login, and error screens receive updates too.

For Vite, use `registerType: "prompt"` and the [UpdateNotice template](../scaffold/templates/src/components/UpdateNotice.tsx). It uses `vite-plugin-pwa` 1.3.0 or newer because `onNeedReload` gives each window control of its own reload. Install `workbox-window` directly as an app dependency. Import `virtual:pwa-register` in one place; do not add a second automatic registration. Include `vite-plugin-pwa/client` types.

The downloaded update must wait for a click. Honor the app's draft and pending-save guards before activating the worker and again before reloading. Another window activating the worker must leave this window's work intact and offer its own update button. Disable repeated clicks while updating, and offer a retry on failure. The template dispatches a cancelable `beforeunload` event; apps with other save guards must connect those guards explicitly. A new app has no drafts yet, but adding editors or persistence must include this integration.

Verify readiness, one-click activation, unsaved-work protection, another window activating an update, new unsaved work during activation, and failure/retry. Mocked callback tests verify the UI; also exercise two builds with a real service worker on an isolated production preview origin. Chrome worker updates bypass Playwright request interception, so serve a changed worker response from a real server. See Tasks' [integration test](https://github.com/HerbCaudill/tasks/blob/63ebd95/e2e/integration/app-update.spec.ts) for the working pattern.

## Focus and page zoom

Inputs, textareas, selects, and editable text use a computed font size of at least 16px on phones. iPhone focus zoom can still occur when the viewport disallows user scaling, so set the font size as well. Check dialog fields, search, autocomplete, and inline editors; a `text-sm` component override can reintroduce the problem.

If a design requires smaller-looking input text, preserve the 16px computed font and scale the input visually. Tourist uses `scale(0.78125)` for a 12.5px appearance, `transform-origin: top left`, and a width of `128%` inside a wrapper that reserves the final visual height. Check caret placement, selection, focus rings, placeholder alignment, and clipping. Do not apply this transform to every form by default.

Disable browser pinch zoom by default, as Herb requested. Use `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`, `touch-action: pan-x pan-y` at the document level, and Safari gesture cancellation as in [preventPageZoom](../scaffold/templates/src/lib/preventPageZoom.ts). `touch-action: manipulation` still allows pinch zoom. Viewport flags alone are insufficient where Safari ignores them. Preserve single-finger scrolling and text selection. Any deliberate in-app zoom, such as a map, needs its own explicit design and gesture scope.

## An immobile app header

Typically use an app shell with a fixed viewport root, an opaque full-width top header, and independently scrolling content. Lock `html` and `body` with `height: 100%`, `overflow: hidden`, and `overscroll-behavior: none`. Set `#root` to `position: fixed; inset: 0; overflow: hidden`. Give the shell `height: 100%`, and the scrolling child `flex: 1; min-height: 0; min-width: 0; overflow: auto`. Avoid `min-h-screen` or document scrolling for this layout.

Declare the header `position: sticky; top: 0; z-index: 30; width: 100%` with a solid background and no flex shrinking. It stays outside the scrolling content. Merely placing a header above a scrolling flex child is insufficient for WebKit's toolbar detection. `position: fixed` can also work, but needs an explicit content offset. Avoid transforms on ancestors that alter fixed positioning.

Check the header while scrolling, dragging beyond both scroll edges, focusing inputs, opening menus and dialogs, rotating the device, and reopening the installed app. The toolbar should not slide or rubber-band. Keep dropdowns above content and dialogs above the header; sticky positioning creates a stacking context and previously caused Tasks' search dropdown to disappear under its board.

## iOS top blur and safe areas

Use `apple-mobile-web-app-capable="yes"` and `apple-mobile-web-app-status-bar-style="default"`. Avoid `black-translucent`. Pair the default status bar with the declared opaque top header. This combination resolved the Tasks blur; the translucent status-bar setting prevented the same header change from resolving it in Bee Buddy and Word Finder.

Do not add a guessed strip of padding to push controls below the blur. The previous 24px workaround and redundant top safe-area padding were removed. Start without `viewport-fit=cover`, as Tasks does. If a design needs edge-to-edge rendering, add it deliberately and account for the actual safe-area insets once on each relevant edge. Keep the opaque header background extending to the top; inset its controls rather than creating a transparent gap above it. Do not add the top inset twice when iOS already places the content below the status bar.

WebKit's blur suppression is a heuristic, not a supported CSS switch. Desktop WebKit emulation cannot confirm the native installed-PWA status bar. Check the deployed HTML first, then verify on the actual installed iPhone app. If status-bar metadata changes do not apply after a full close and reopen, a fresh Home Screen installation may be needed; preserve local data or credentials before removing an installed app. Report any remaining device check honestly.

## Adapt and visually confirm every layout

Once a desktop layout is chosen, make its mobile version part of the same work. Decide which panes stack, become drawers, or become separate screens. Adapt navigation, controls, dialogs, and dense content deliberately. Do not shrink the desktop canvas or rely only on hiding overflow.

Inspect rendered screenshots at desktop size, a narrow phone (about 320–375 CSS pixels), and a typical phone (about 390–430 CSS pixels). Open and inspect the screenshots; passing assertions or generating an image without looking at it is insufficient. Check portrait and landscape, long labels and realistic content, empty/loading/error states, menus, inline editing, and keyboard-open states where available. Verify readable type, reachable controls, no accidental page-wide horizontal scrolling, and usable touch targets. Keep desktop hotkey hints and the keyboard reference off mobile layouts, as described in the [app-design skill](../app-design/SKILL.md).

Run focused browser checks with touch-enabled Chromium and iPhone WebKit profiles. Use an isolated port, fail if it is occupied, and verify the app identity; reusing a shared dev/preview port previously tested Tasks while agents thought they were testing Tourist and Bee Buddy. Mobile browser emulation covers layout and browser behavior; physical iPhone checks cover native blur, keyboard viewport movement, focus zoom, and pinch gestures. Keep desktop and mobile screenshots as review evidence, and distinguish emulated checks from device confirmation.
