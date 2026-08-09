# Renderer input

The renderer accepts a JSON document with `schemaVersion: 1`. The TypeScript contract lives in `../scripts/types.ts`.

## Minimal shape

```json
{
  "schemaVersion": 1,
  "title": "Plan 007: Including the response variant in the cache key",
  "lede": "The same endpoint can return two valid shapes. The cache now keeps them separate.",
  "date": "2026-08-09",
  "slug": "variant-cache-key",
  "repository": {
    "path": "/absolute/path/to/repository",
    "base": "0123456789abcdef",
    "head": "fedcba9876543210"
  },
  "meta": ["0123456 → fedcba9", "4 commits"],
  "summary": [{ "value": "12", "label": "files changed" }],
  "codeBlocks": [],
  "files": [],
  "sections": [
    { "id": "background", "title": "Background", "html": "<p>…</p>" },
    { "id": "intuition", "title": "Intuition", "html": "<p>…</p>" },
    { "id": "code", "title": "Code", "html": "<p>…</p>" },
    {
      "id": "files",
      "title": "File index",
      "kind": "files",
      "html": "<p>Search by path, purpose, or category.</p>"
    },
    { "id": "verification", "title": "Verification", "html": "<p>…</p>" }
  ],
  "footer": "Generated 9 August 2026 · 0123456 → fedcba9"
}
```

Write the section bodies as trusted HTML. The renderer escapes document metadata, code captions, file paths, descriptions, and tags.

## Code blocks

Place `{{CODE:identifier}}` in a section body and add a matching item to `codeBlocks`.

Prefer a pinned source declaration for TypeScript or JavaScript code:

```json
{
  "id": "cache-key",
  "title": "The variant is part of the cache address",
  "language": "typescript",
  "source": {
    "revision": "head",
    "path": "src/data/resourceQueryKey.ts",
    "needle": "export function resourceQueryKey"
  }
}
```

`revision` may be `base`, `head`, or an explicit Git revision. The renderer resolves it to a commit SHA, reads it with `git show`, and uses the TypeScript parser to extract the complete declaration. Set `deleted: true` and use `revision: "base"` for deleted code.

Use an explicit `code` string for other programming languages, JSON examples, shell output, declarations without braces, or a deliberately small expression. Supply `path` and `line` when it should link to source.

## File cards

Include one entry for every path from `git diff --name-status -M <base> <head>`:

```json
{
  "status": "R100",
  "oldPath": "src/data/oldName.ts",
  "path": "src/data/newName.ts",
  "description": "Renames the resource aggregate around the generated registry.",
  "tags": ["Resources", "Vocabulary"]
}
```

Write descriptions for readers, not for Git. Say what changed or why the file exists. Keep categories broad enough to filter usefully; a file may have several tags.

The renderer creates `<date>-explanation-<slug>-files.diff` beside the HTML. Added files link to the repository path. Modified, renamed, and deleted files link to their patch in that companion file.

## Reusable components

Use these HTML families in section bodies. Keep their meaning consistent across the document.

Blue callout:

```html
<div class="note">
  <strong>Memory and persistence have different rules.</strong>
  A damaged load may remain useful in memory, but the next session should revalidate it.
</div>
```

Flow:

```html
<div class="flow">
  <div class="flow-step"><strong>Source</strong><small>Concrete input</small></div>
  <div class="flow-step"><strong>Transform</strong><small>Important decision</small></div>
  <div class="flow-step"><strong>Result</strong><small>User-visible outcome</small></div>
</div>
```

Two-way comparison:

```html
<div class="comparison">
  <div class="panel">
    <header>Before</header>
    <div class="content">…</div>
  </div>
  <div class="panel">
    <header>After</header>
    <div class="content">…</div>
  </div>
</div>
```

Result cards:

```html
<div class="checks">
  <div class="check">
    <strong>Every action stays visible.</strong><br />Missing facts fail closed.
  </div>
  <div class="check">
    <strong>Evidence follows helpers.</strong><br />Delegated sources are pinned.
  </div>
</div>
```

Do not add custom callout colors, collapsible file rows, or a file-index table. Extend the component vocabulary only when the explanation needs a relationship that these families cannot show clearly.
