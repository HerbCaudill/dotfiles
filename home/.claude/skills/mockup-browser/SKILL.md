---
name: mockup-browser
description: Use when presenting UI or design direction options to Herb — early-stage explorations, competing layouts, visual directions for a new tool or feature. Produces a single self-contained HTML file with tabbed navigation where each option is a complete standalone mockup of the same fictional scenario, with why/tradeoff notes per option.
---

# Mockup browser

## Overview

When Herb asks for design directions or UI options, don't produce loose mockup files or a wall of screenshots. Build one self-contained HTML file — a "mockup browser" — with a tab per option. Each option is a complete standalone page embedded via `srcdoc`, preceded by a one-line **Why** and a one-line **Tradeoff**. The whole deliverable opens from a single file and works offline (fonts aside).

The worked example this skill is based on: `~/Code/HerbCaudill/marvin/mockups/ui-directions.html`.

## Process

1. Copy `template.html` (in this skill's directory) as the shell. Replace `{{TITLE}}`, `{{SUBTITLE}}`, `{{TABS}}`, and `{{PANELS}}`. Don't modify the shell's styles or script.
2. Invent **one realistic fictional scenario** and render it identically in every option. Use real project names, plausible task titles, believable timestamps and counts — never lorem ipsum or "Item 1". The subtitle should say so explicitly, e.g. "…all showing the same fictional day. Compare shape, not content."
3. Design **4–7 options spanning genuinely different philosophies** — dashboard vs. document vs. inbox vs. board vs. terminal vs. multi-pane app — not variations on one layout. Label them `A · Name`, `B · Name`, …. Off-menu ideas (a menu-bar sketch, a phone widget) go at the end as `Bonus · Name`.
4. For each option write the meta block: **Why** is one sentence on the philosophy and what it's best at; **Tradeoff** is one honest sentence on the cost. No hedging, no marketing.
5. Build each mockup as a **complete standalone HTML page** at a fixed canvas, then escape it into the `srcdoc` attribute (see below).
6. Save the file where it belongs in the repo (typically `mockups/<topic>.html`), open it for Herb (or publish as an artifact if that's the session's medium), and give a one-paragraph orientation — don't re-describe every tab.

## Mockup pages

Each `srcdoc` page is fully self-contained:

- Fixed canvas, default **1280×840**. The wrapper's `--w`/`--h`, the iframe's `width`/`height`, and the mockup's root div dimensions must all match. Use a different size only when the form factor demands it (e.g. a menu-bar popover still sits on a 1280-wide canvas with the popover drawn inside it).
- `<!doctype html><html><head>` with a Google Fonts link and a tiny `<style>` block for `body` and link colors only; everything else is **inline styles** on divs. No classes, no external CSS, no JavaScript inside mockups — they are pictures, not prototypes.
- IBM Plex only: Sans for UI, Mono for terminal/code aesthetics, Serif for editorial directions. Sentence case everywhere.
- Each option commits to **its own palette** — a dark ops dashboard, a warm paper editorial page, a cool light app — chosen to reinforce that direction's philosophy. No theme switching.
- Inline SVG for icons (Tabler-style: 24×24 viewBox, stroke-width 2, round caps/joins).
- Static states drawn explicitly: fake cursor blocks, pre-filled command lines, hover-less buttons. Interactive affordances are drawn, not wired.

## srcdoc escaping

This is the part that goes wrong. Write each mockup as normal HTML first, then place it in `srcdoc="…"` with exactly two substitutions, in this order:

1. `&` → `&amp;` (this catches `&` in font URLs like `family=IBM+Plex+Sans:wght@400&display=swap`)
2. `"` → `&quot;` (every attribute quote inside the mockup)

Single quotes stay as-is (use them inside inline styles for font names). Newlines are fine inside the attribute. Verify by opening the file: if a tab renders as raw text or cuts off early, an unescaped `"` ended the attribute prematurely.

## Quality bar

- Every option must look **finished** — real hierarchy, aligned spacing, considered color — not wireframe-gray boxes. The point is to feel what each direction would be like to live with.
- Data must be **consistent across options**: same counts, same item names, same timestamps. If option A shows "3 items need attention", every option shows those same 3 items.
- Meta lines are load-bearing: a reader should be able to pick a direction from the Why/Tradeoff pairs alone before looking at anything.
