---
name: viz-data-flows
description: Build an interactive vertical swimlane page that traces how data moves through a codebase, step by step, across ownership lanes (feature code, libraries, SDKs, servers, storage). Use whenever Herb wants to see, illustrate, diagram, or explain a data layer, a request path, how a page loads or saves its data, cache and persistence behavior, cache hits versus misses, or what a mutation touches, even if he does not say "diagram" or "swimlane". Also use when asked to visualize an architecture from the perspective of one request or one user action.
---

# Data flow swimlanes

Produce one self-contained HTML page, saved in the repository, that shows a handful of concrete flows through the code as vertical swimlanes. Each flow is a sequence of steps; each step sits in the lane that owns it and links to its source file. The page is a map into the code, not a document about it.

The template in this folder is the renderer. Copy it, replace the model block, and the rest works: tabs, variant switches, wrapped nodes, sticky headers, popovers with VS Code links, dark mode. Do not restyle it or rewrite the renderer for a new repository; put the effort into getting the steps right.

Worked example: `~/Code/HerbCaudill/viberesults/docs/data-flows.html`.

## Process

### 1. Read the code before drawing anything

Every node must correspond to something real: a function, a hook, a cache policy, an endpoint. Read the data-layer entry points and follow one call all the way to the network and back before writing a step. Grep for the bridge functions (the places where the app hands work to a library or SDK) and count the call sites; those counts belong on the nodes ("×22 bound calls").

Write down, for each step, the file path. If a step has no single file, it is probably a library or server step and the popover can name the package or host instead.

### 2. Choose the lanes

Lanes are ownership boundaries, ordered so that a request reads left to right from the screen toward the server, with storage next to the cache it mirrors. Five to seven lanes is the useful range. Typical set:

- feature or route code
- the app's own bridge to its data library
- in-memory cache
- durable storage (IndexedDB, files)
- runtime or effect system
- SDK or generated client
- the server

Give each lane an owner (who maintains that code), a name, its path or package, and one sentence saying what it is responsible for. The lane's kind picks its color: `app` for the repository's own code, `lib` for third-party libraries and the browser, `sdk` for a first-party package the repo consumes, `srv` for the server. A reader should be able to tell from color alone which hops are "ours".

### 3. Choose the flows

Three or four flows that together cover load, mutate, and the interesting cache behaviors. The ones that have earned their place:

- **Index or list load.** The fan-out: how many requests, how they are keyed, how they are joined, what is persisted.
- **Detail page.** Load one record, then save one field, then delete. Mutations are where cache policy shows itself: what is patched in place, what is invalidated, what is evicted.
- **Bulk change.** Cancellation of in-flight reads, optimistic patching, reconciliation after overlapping requests, the failure branch.
- **Cache-state variants** of the load flow: cold (nothing stored), warm (served without a request), stale (served, then revalidated). Use the template's `variants` so they share a tab and a switch; side by side they make the cache policy legible in a way prose does not.

Split a flow into phases where its purpose changes: "Session bootstrap", "Load", "Render", "Persist". Phases are drawn as dashed rules with a heading.

### 4. Write the steps

A step is `[lane, title, sub, file, edgeLabel]`. Keep every string short and concrete:

- `title` is the function or thing, in the code's own name: `getEndpointQueryOptions`, `restoreClient`, `GET /api/awards`. Long identifiers wrap at capital letters, so do not abbreviate them.
- `sub` is one detail worth knowing at a glance: `meta.persistedCodec = project-index.*.v1`, `first offer at once · then 1 s coalesce`. Leave it empty rather than restating the title.
- `file` is the repository-relative path. The popover links it to VS Code when the page is opened from disk.
- `edgeLabel` names what travels to the next step: `22 bound calls`, `queryFn({ signal })`, `wire JSON`. An unlabeled arrow is "and then"; a labeled one is information.

Mark a failure or side path with `{ branch: "api" }` as the sixth element; it is drawn as a dashed branch off the last step in that lane rather than continuing the sequence.

Write no prose on the page beyond lane roles and node text. No introduction, no "people often ask", no captions explaining what the reader can see. Everything the page says should be a fact from the code.

### 5. Build, save, commit

1. Copy `template.html` from this skill folder to the repository, usually `docs/<something>.html`.
2. Replace the block between `// ===== MODEL =====` and `// ===== END MODEL =====` with the model. Set `rootFromPage` to the relative path from the page's directory to the repository root (`".."` for `docs/`).
3. Set the `<title>`.
4. Open the file in Chrome to check that nothing overflows its node and the edge labels have room. The renderer sizes nodes from their text, so overflow usually means a `sub` string that wants to be shorter.
5. Commit the page with a message that says which flows it covers.

Do not publish it as an artifact unless asked; the repo file is the deliverable, and the VS Code links only work from disk anyway.

## Model reference

```js
const model = {
  title: "Data flows",
  rootFromPage: "..",
  lanes: [{ id, owner, head, sub, kind: "app" | "lib" | "sdk" | "srv", role }],
  flows: [
    { id, label, phases: [[stepIndex, "Heading"]], steps: [[lane, title, sub, file, edgeLabel, opts?]] },
    { id, label, variants: { label: "Switch label", options: [{ id, label, phases, steps }] } },
  ],
}
```

`opts` is `{ branch: laneId, label?: "failure" }` for a branch step. Steps are drawn in array order; the branch step is skipped by the main sequence and connected from the most recent non-branch step in the named lane.

## What to keep in mind

- Accuracy over completeness. A flow with twelve true steps beats one with twenty that includes a guess. If a hop is unclear, read more code.
- Counts, keys, and thresholds are the most valuable text on the page: "fresh for an hour", "×22", `buster == "5:" + scope`. They come from constants and call sites, so quote them exactly.
- Lane order matters more than it looks. Put storage beside the cache, and the runtime beside the SDK it runs, so most arrows are short.
- The page is meant to be re-read after the code changes. Keep steps tied to named functions so a rename is easy to spot and fix.
