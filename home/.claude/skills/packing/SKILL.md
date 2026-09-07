---
name: packing
description: Create or update a trip packing checklist in Herb's Obsidian vault. Use when Herb asks to pack for a trip, make a packing list, or update the packing master.
---

# Packing

Gather trip details, clarify the choices that affect packing, then copy and adapt the master list. Use Markdown directly; no JSON catalog or generation script.

## Sources

The authoritative master is [master-list.md](master-list.md), beside this skill's `SKILL.md`. Read and edit it in the repo-managed skill directory. Do not maintain a second master in the vault.

The vault is `~/Code/HerbCaudill/notes`. Paths below are relative to its root:

- Index: `packing.md`
- Past trips: `documents/packing/`
- Hiking reference: `documents/packing/hiking master list.md`
- Diving reference: `documents/Diving checklist.md`
- Worked example: `documents/Edinburgh Sept 2026.md`

Read the current master each time. Follow links from the index and search the vault for an existing trip note before creating one. Past trips provide examples, not proof that every item or quantity is still wanted. Do not infer a permanent preference from a missing or unchecked item.

## Gather information

Start with what Herb has already said. Search connected email and calendar for the specific trip, using bounded date windows and destination variants where useful. Prefer first-party connectors; use the relevant gws skills and `gws-delegated` only when those cannot do the work. Read relevant confirmations beyond search snippets. Extract dates, local departure and arrival times, baggage booked, accommodation, car rental, and activities. Distinguish confirmed arrangements from tentative plans, marketing offers, canceled bookings, and declined meetings. Keep searches focused and avoid unrelated personal correspondence.

Count travel days as well as nights. Check the forecast for the actual destinations when within forecast range; otherwise use sourced seasonal expectations and label them as such in conversation. Use weather to choose clothes and layers. Do not treat the absence of a booking email as evidence that there is no booking. If a source is unavailable, say so briefly and ask for the missing detail.

Briefly summarize the facts that affect packing, then clarify remaining decisions. Do not turn the request into travel booking or general trip administration.

## Clarify

Ask one concise question at a time. Use answers already given; skip questions that do not affect the list. A useful sequence is:

1. Accommodation and broad plans, if unclear.
2. Proper hiking versus sightseeing and short walks, or other plausible activities such as skiing, snorkeling, scuba, or swimming.
3. Whether to bring the cooking kit, if an apartment or other cooking accommodation is involved. An apartment alone does not mean the kit is wanted.
4. Whether to bring the computer. A holiday or declined meetings do not settle this.
5. Whether laundry is planned.

Ask about unusual clothing needs, baggage constraints, or bringing versus renting activity equipment when relevant. Do not ask about every possible activity on every trip. Make reasonable low-impact assumptions and state material ones briefly in conversation. Once enough is known, write the list without another approval step.

## Create the checklist

Use an existing note at its current path, including an empty note created through an index link. Otherwise create `documents/packing/{Destination Mon YYYY}.md`, matching Herb's supplied title when there is one. Add `- [ ] [[Trip title]]` at the top of `packing.md` only if that trip is not already linked. Preserve existing index status and other entries. Use a path-qualified wikilink if needed to resolve duplicate note names.

Copy the master and edit it for the trip. Remove irrelevant sections and individual items, add relevant essentials, and propose quantities. Include computer accessories when bringing the computer; headphones can belong in the backpack even without it. Include the appropriate car kit and driver's license when driving. Select destination-appropriate plug adapters. Short walks do not require the hiking kit.

Keep snorkeling and scuba in their own self-contained sections. Each retained section must list its equipment explicitly, without relying on another section or an opaque item such as "scuba gear." When both apply, shared equipment may appear in both sections so each stays complete; this means the same equipment, not a request to pack two sets. Consult the specialist references when relevant and account for rented gear.

Propose clothing quantities from travel days, laundry intervals, activities, and weather. Quantities under Clothes are packed items, additional to the Wear outfit. For five days without laundry, the Edinburgh example uses five packed pairs of boxers and socks: four changes plus a spare. This is a starting point, not a fixed rule for every trip. Allow sensible reuse of outer clothes and avoid unnecessary shoes. Herb can adjust the quantities.

The note is just a checklist. No introductory commentary, title heading, tags, frontmatter, trip summary, itinerary, sources, assumptions, quantity explanations, or closing prose. Keep any explanation in conversation. Use the master's nested checkbox format:

```markdown
- [ ] **Wear**
  - [ ] 1 t-shirt
- [ ] **Clothes**
  - [ ] 5 boxers
```

New lists start unchecked. When editing an existing populated list, preserve checked items, manual additions, wording, and quantities unless the requested change requires modifying them. Never regenerate over packing progress.

## Verify and finish

Read the saved note and index. Check quantities against the trip, remove accidental duplicates and empty sections, and verify that the index link resolves to exactly one intended note. Preserve shared equipment in the self-contained activity sections and intentional separate supplies, such as a cable kept in the car kit. Follow the repositories' commit and push instructions, staging only this task's changes. No automated tests are needed for checklist or instruction edits.

Return a brief completion message with a clickable link to the note. Invite corrections when useful without repeating the whole list.

Trip-specific choices change only that trip. Explicit lasting preferences update `master-list.md` beside this skill. Herb has permanently removed the toll transmitter, guidebooks, maps, Apple TV, and spare sunglasses; do not reintroduce them from old lists unless he asks. Keep the inventory in that file rather than duplicating it in these instructions or the vault.
