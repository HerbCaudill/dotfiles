---
name: explain-diff
description: Use when the user asks for a rich explanation of a code change, diff, branch, or PR. Produces HTML output.
---

# Explain Diff

Create a rich, interactive explanation of the specified code change. Use the `writing` skill for the prose and the bundled renderer for the document.

Read [references/input-format.md](references/input-format.md) before authoring the renderer input.

## Inspect the range

Resolve the requested base and head to commit SHAs before reading source. Inspect the commit sequence, name-status diff, line counts, and surrounding code at both revisions.

Read historical source with `git show <sha>:<path>`. Do not read a pinned explanation from the current worktree: it may move while the explanation is being written.

Explore enough surrounding code to explain the system, not only the changed lines. Trace callers, tests, generated output, persistence boundaries, and user-visible behavior when they matter.

## Structure

### Background

Explain the existing system relevant to this change. (You should broadly explore surrounding code for this.) We don't know how much the reader already knows, so include a deep background for beginners (note that it can be skipped if the reader is already familiar), and then a more narrow background directly relevant to the change.

### Intuition

Explain the core intuition for the code change. The focus here is to explain the essence, not the full details. Use concrete examples with toy data. Use figures and diagrams liberally.

### Code

Do a high-level walkthrough of the changes to the code. Group/order the changes in an understandable way. Include links to the relevant code files and line numbers that will open in VS Code.

### File index

Include every changed file as an always-visible card. Give each card its Git status, linked filename, one-sentence description, and one or more category tags.

The renderer links added files to the current file in VS Code. It writes a companion combined diff and links modified, renamed, and deleted files to the first line of their exact patch.

### Verification

Explain what was tested, what passed, and any known unrelated failures or remaining risks.

## Format

Prepare a versioned JSON input and render it with:

```sh
node ~/.claude/skills/explain-diff/scripts/runRenderExplanation.ts <input.json> <output.html>
```

The managed dotfiles workspace installs the renderer dependencies with its normal root `pnpm install`. For a standalone copy of the skill, run `pnpm install --dir ~/.claude/skills/explain-diff/scripts --frozen-lockfile` once before rendering.

Put both input and output in a global temporary location outside the code repository. The HTML filename must start with today's date in `YYYY-MM-DD-` format, for example `/tmp/2026-01-12-explanation-<slug>.html`.

The bundled [assets/explanation-template.html](assets/explanation-template.html) produces one self-contained HTML file with embedded CSS, JavaScript, and IBM Plex fonts.

Show complete semantic units. For a TypeScript or JavaScript function, class, object, or method, use a pinned `source` declaration in the renderer input so [scripts/extractBracedDeclaration.ts](scripts/extractBracedDeclaration.ts) includes the signature, body, closing boundary, and adjacent JSDoc. Use explicit complete excerpts for other languages. Do not use arbitrary line slices. Include an import only when the explanation needs it;.

Use the one blue callout style for key concepts, definitions, and edge cases. Do not introduce warning-colored callouts. Keep headings inside callouts and summary cards black.

Render the file index as cards, not a table. Keep every description and tag visible. Do not add expand/collapse behavior. Keep filenames on one line with ellipsis rather than wrapping; the full path belongs in the link tooltip.

## Diagrams

Ideally, you should pick a small number of diagram families that can be reused throughout the explanation to explain various cases. Some useful kinds of diagrams:

- A very simplified version of the UI that the user sees in the app, to explain UI changes.

- A system diagram showing data flow or communication between components. Make sure to include example data here!

Don't use ASCII diagrams. Always use simple HTML designs for your diagrams, HTML lists for lists of things, etc.

## Verify the artifact

Run the renderer, open the HTML, and inspect it at desktop and narrow widths. Confirm:

- the narrative follows Background → Intuition → Code → File index → Verification;
- every changed file appears once;
- code snippets start and end at coherent semantic boundaries;
- modified, renamed, and deleted file links point into the companion diff;
- added file links point to the repository file;
- file descriptions and tags are visible without interaction;
- filenames do not wrap and the page has no horizontal overflow;
- all callouts use the blue style and card headings are black;
- code uses GitHub light syntax colors and preserves whitespace; and
- the browser console has no errors.
