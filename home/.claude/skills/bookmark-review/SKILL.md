---
name: bookmark-review
description: Use for Herb's interactive X bookmark processing: research sources and media, present one item at a time, develop useful reflections or capture agreed actions, then remove decided bookmarks and record verified outcomes. Also use when resuming an existing bookmark-review log.
---

# Bookmark review

Help Herb turn saved material into something useful: an action, a reading or viewing choice, an improvement to his tools, a reflection in his personal knowledge base, or a decision to let it go. Do not assume every bookmark deserves a task or a permanent note.

This is an interactive review. Ask one question at a time in plain chat. Never use question or user-input tools, including for clarification and decisions.

## Establish the queue

Read the existing vault review log and any supplied handoff before acting. Merge by post ID, preserving newer decisions and distinguishing proposals from completed actions. The current log is `documents/X bookmark review.md` in Herb's notes vault. Re-read it before each decision write to preserve concurrent or synced changes.

Use the agreed frozen export in its existing order and retain its original item numbers. Do not sort by post date, batch the decisions, pre-filter by topic, or quietly replace the queue with a fresh export. New arrivals belong to a separate intake unless Herb expands the scope.

Reconcile the frozen queue against a freshly paginated live bookmark list. The maintained export retains removed items. Skip verified prior removals, recording them as already absent without inventing a reason or claiming the agent removed them. Recheck live presence before presenting an item if the live state may have changed.

Never hand-edit the maintained vault exports `documents/X bookmarks.md` or `documents/x-bookmarks/bookmarks.json`. Save research artifacts outside those files. Preserve the frozen source too.

For the October 25, 2026 review, the frozen 145-item export is `C:\Users\herb\setup\bookmarks-review-2026-10-25.md` on the mini; its original Mac copy is `~/.local/share/x-bookmarks/bookmarks-2026-10-25.md`. These paths identify that campaign, not a permanent requirement for future queues.

## Research before presentation

Research the full post, author, quoted posts (including nested quotes), linked articles, images, and videos or talks before presenting the item. Prefer authenticated X API reads and primary sources. Do not infer a person's name from their handle or email; use a verified profile or their display name. Distinguish the author's claims, evidence, your assessment, and guesses about why Herb saved it.

- Prefer `note_tweet.text` to truncated `text`. Expand URL entities, including entities inside `note_tweet`. A normal read or oEmbed response may omit the long-post body.
- Fetch quoted posts directly as needed; expansions may omit nested quotes or their media. Request media variants and duration to find the actual video.
- For X Articles, obtain the actual full body. The parent post's `article` field can return `title` and `plain_text` with `tweet.fields=article`. A preview or title is insufficient. If API access fails, use signed-in Chrome under the applicable browser instructions. A failed public URL does not prove the article body is unavailable.
- Read linked article bodies, rather than relying on snippets, blurbs, or somebody else's summary. For a book announcement, verify the book and available formats; do not imply you have read the whole book.
- Inspect attached images, including text inside them. Obtain a transcript or a solid source-grounded summary of the actual video or talk. If transcribing locally, inspect relevant visual material too, preserve timestamps, and label machine-transcription uncertainty. Never substitute another similarly titled video.
- Check consequential or disputed claims against current primary evidence. Separate anecdotes, marketing, observational findings, and established results. Avoid both credulity and a ritual debunking tone.

If material is inaccessible, state the precise gap and keep the research incomplete. Do not fill it with a plausible guess. Respect source-reproduction limits when presenting content; link and clearly label any necessary summary instead of passing it off as the full source.

Background research may run ahead when authorized, but presentation and decisions remain one at a time. Reuse verified research and saved full bodies; do not repeatedly fetch or transcribe unchanged material just to demonstrate activity.

## Present and discuss

Show the verified full post inline before the brief, including quoted posts where permitted. Use a self-contained HTML card with the author, handle, date, original link, and supported images or playable video. Distinguish article summaries from the post itself. A static sourced card is fine; do not claim it is a live X widget or fall back to a truncated embed.

In T3 Code, call `html_preview` and then `html_render` with the HTML. Follow the renderer's theme and layout rules. Do not start a server just to show the card.

Follow with a short explanation of what is useful, what is uncertain, and a question suited to this item. Do not recite the whole research report, force a choice among the same categories every time, or turn every reaction into a task proposal.

For reflective material, use [thinking-partner](../thinking-partner/SKILL.md). Herb wants sources to provoke his own thinking and contribute to a richly interlinked personal wiki or zettelkasten. A quote collection or read-later dump is not a substitute for his reflection. Preserve his uncertainty and distinguish his thoughts from the source and the agent's interpretation. Search existing notes before proposing additions, and make only meaningful connections.

## Capture in the right place

Use the destination Herb chooses. Interest alone does not authorize a task, purchase, signup, system change, or message to somebody else.

- Actual commitments or agreed actions: use the [tasks](../tasks/SKILL.md) skill and managed Tasks CLI, with its identity, receipt, and read-back checks. Do not use Google Tasks as a fallback.
- Books he might read: his usual destination is Apple Books' **Want to Read** collection. Do not replace this with Tasks or a new vault reading list. Verify an app capture if making it yourself; if unavailable, provide the book link and wait for Herb's confirmation that he captured it.
- Shows he might watch: use his existing Obsidian TV shows note when requested. The existing note is `documents/archive/TV Shows.md`; confirm its current location and preserve its format. Do not create a watch task by default.
- Reflections: propose an addition to an existing note or a short connected idea note grounded in Herb's thoughts. Let him review before saving unless the specific write is already authorized. Do not manufacture a note or new taxonomy merely to empty the queue.
- Tool or workflow changes: discuss or investigate before installing or changing anything unless Herb has authorized the particular action.

For a snoozed action, distinguish an announced date from a chosen follow-up date. If ticket sales have no published date, say so; do not invent one. Preserve the source link and reason for the check.

## Standalone follow-up conversations

When Herb asks for a new agent session during this review, always create a standalone top-level session. Do not use a subagent or delegated child for a conversation he intends to have directly. This also applies to reflective discussions and involved investigations.

Give the session the source URL, relevant context, and saved research locations. For reflective sessions, explicitly invoke the thinking-partner skill and plain-chat questions. Have the conversation there, rather than relaying its questions into the bookmark review. Continue reviewing independently when Herb asks.

If Herb asks to send another source to an existing discussion, send it to that session rather than creating a duplicate. Read the thread as required by the tools before describing its state. Retain and share its exact returned link. Follow the current orchestration rules for launch, delivery, and waiting.

## Decisions, removal, and audit trail

Herb gives standing authorization to remove a bookmark once he makes its decision and any required capture or handoff succeeds. Do not ask a second “remove now?” question. An explicit discard needs no other capture. A request to start a discussion can resolve the bookmark once the session is created. If he explicitly wants to keep a bookmark, preserve it and record the keep decision.

A factual question, process correction, tentative reaction, or request to continue past an unresolved item is not automatically a removal decision. Clarify genuine ambiguity once. Record deferred items explicitly so they are not lost when the pointer advances. Never let the goal of draining the queue substitute for an individual decision.

X authentication currently lives on the mini. Apply [mini](../mini/SKILL.md). Remove only with `xurl --app bookmarks unbookmark <post-id>` on that machine; from the Mac, run it through `ssh mini`. Never reauthenticate X on the Mac, which would invalidate the mini's login.

Check the command result, then independently paginate the live bookmarks and verify the ID is absent. A successful idempotent unbookmark establishes the final state, not that this invocation caused a removal that had already happened. If the mini or verification is unavailable, record the approved action as pending and retry safely later; do not claim completion.

Record each decision, its reason in Herb's terms, source IDs/links, resulting note/task/session links, and actual verified action outcome in the review log. Preserve historical entries while clearly marking later decisions as superseding earlier pending proposals. Update the resume pointer and list unresolved/deferred items and pending removals.

At a handoff, keep the frozen queue, research artifacts, current pointer, standing preferences, and outstanding actions discoverable. An automatic goal continuation supplies no new user approval. Do useful independent preparation if available, then wait for the pending decision without repeatedly asking it or advancing the interactive review. Apply the goal system's blocked-state rules if applicable; completion requires every original item to have a recorded disposition or explicitly resolved handoff, with approved actions verified.
