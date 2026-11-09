---
name: bookmark-review
description: "Review or resume Herb's X and Bluesky bookmarks one at a time: research, discuss, save reading to Matter, and verify agreed actions."
---

# Bookmark review

Help Herb turn saved material into something useful: an action, a reading or viewing choice, an improvement to his tools, a reflection in his personal knowledge base, or a decision to let it go. Do not assume every bookmark deserves a task or a permanent note.

This is an interactive review, one bookmark at a time. Ask for each bookmark's decision with the question tool, with these options:

- **Discard:** remove the bookmark with no capture.
- **File:** put it in his notes and/or make a task, whichever fits the item (see "Capture in the right place").
- **Discuss in a new session:** start a standalone session about it (see "Standalone follow-up conversations").

He can answer with free text instead. Never batch decisions for several bookmarks into one question. Use plain chat for any follow-up that the choice leaves open, one question at a time.

This skill covers two things: using the X, Bluesky, and Matter CLIs, and working with Herb to process bookmarks one at a time. It is usable from any repository or conversation.

## Working with bookmarks through the CLIs

### X bookmarks

X authentication lives on the mini. Apply [mini](../mini/SKILL.md) and use `xurl --app bookmarks`; from the Mac, run it through `ssh mini`. Never reauthenticate X on the Mac, which would invalidate the mini's login.

- List bookmarks with a GET request to `/2/users/16202589/bookmarks?max_results=100`. Follow each response's `meta.next_token` using `pagination_token` until no token remains or the 800-post API window is reached. Do not treat the first page as the complete queue.
- Request `tweet.fields=created_at,author_id,entities,note_tweet,article,referenced_tweets,attachments` with author, referenced-post, and media expansions. Include user names and handles, and media URLs, variants, alt text, and duration as needed. Read a specific post through `/2/tweets/<post-id>` with the same relevant fields.
- Preserve post IDs as the stable identities. Expand links from both normal and long-post URL entities. The maintained export can contain historical posts that are no longer bookmarked, so verify current presence through the live list.
- Remove an authorized bookmark with `xurl --app bookmarks unbookmark <post-id>`. Then independently paginate the live list and verify the ID is absent. Apply the decision rules below before any removal.

Use read-only commands to inspect or refresh the queue. Do not change other X account state while processing bookmarks. To show a post in the thread, use [tweet-cards](../tweet-cards/SKILL.md) as described in "Present and discuss".

### Bluesky bookmarks

Run these on the mini, where the app password lives, from `C:\Code\HerbCaudill\leo`; from the Mac, go through `ssh mini`. Never print `~/.config/bluesky/app-password` or pass it in a command.

- `pnpm -s bluesky:bookmarks list` prints every live bookmark as JSON, following all pages. Each `item` is a post, with its text in `record.text`, full links in `record.facets`, and images, link cards, video, and quoted posts in `embed`.
- `pnpm -s bluesky:bookmarks remove <post-at-uri>` removes one bookmark, then re-reads the live list and verifies it is absent. Apply the decision rules below before any removal.

Preserve the post's AT URI as its stable identity. Its link is `https://bsky.app/profile/<did>/post/<rkey>`. The maintained archive is `documents/bluesky-bookmarks/bookmarks.json` and `documents/Bluesky bookmarks.md`; like the X export, it retains removed items and must not be hand-edited.

Keep Bluesky in its own review with its own queue and log, `documents/Bluesky bookmark review.md`. Everything below about research, presentation, capture, decisions, and the audit trail applies the same way, using the Bluesky commands in place of the X ones. Show Bluesky posts as self-contained cards, as described in "Present and discuss". `tweet-cards` is X-only. A bookmarked post deleted since it was saved no longer appears in the live list, so check the archive for its text.

### Save long-form reading to Matter

Use the installed Matter CLI on the mini. It is authenticated for Herb, with credentials in its local config. On Windows the executable is `~/.matter/bin/matter.exe`; resolve that path explicitly if `matter` is not on the current process's PATH. From the Mac, use `ssh mini` under the [mini](../mini/SKILL.md) instructions. Do not copy or print the credential file, put a token in command arguments, or generate a replacement token to fix an ordinary command failure. If credentials are missing, use T3's private secret input with file delivery and pipe the token to `matter login` without exposing it in logs. Matter's [CLI documentation](https://docs.getmatter.com/cli/quickstart) covers installation and authentication.

1. Establish the exact reading target. For a post linking to an external essay, save the expanded original article URL, not a `t.co` redirect or the surrounding X post. For a native X Article or long thread, use its original URL and verify that Matter extracts the actual body. Keep the source post permalink separately in the review log.
2. Check access with `matter account`. An instruction to save an item for later authorizes saving it to Matter; no second destination confirmation is needed. This does not authorize subscribing to a publication or buying access.
3. Save with `matter items save --url "<article-url>" --status queue`. Use JSON output. Retain the returned item ID and URL before doing anything else. Matter returns an existing item for an already-saved URL; inspect its current state rather than assuming a new save or resetting existing reading progress. If an existing item is archived, requeue it only when Herb's decision authorizes that; otherwise clarify once.
4. Read it back with `matter items get <item-id> --include markdown`. Verify the expected URL, queue status, and successful content extraction. If extraction is still processing, make a bounded follow-up check and leave the capture pending if it is not ready. Inspect the extracted text for native X Articles, threads, and paywalled content; a title or teaser does not establish a readable save. If extraction fails, record the exact gap and keep the X bookmark until an agreed alternative succeeds.
5. Record the source post ID/link, article URL/title, Matter item ID, and verified outcome in the review log. Use a returned Matter app link if one is supplied; do not invent an item URL. Reuse this receipt on resume and retry the same article URL after a lost response, rather than claiming that the previous save failed or creating a different copy.

Once the reading capture is verified, apply the decision-and-removal rules below. A pending or failed Matter save does not resolve the bookmark. Do not add an arbitrary test article to Herb's library merely to check the CLI.

## Processing bookmarks with Herb one by one

### Establish the queue

Read the existing vault review log and any supplied handoff before acting. Merge by post ID, preserving newer decisions and distinguishing proposals from completed actions. The current log is `documents/X bookmark review.md` in Herb's notes vault. Re-read it before each decision write to preserve concurrent or synced changes.

Use the agreed frozen export in its existing order and retain its original item numbers. Do not sort by post date, batch the decisions, pre-filter by topic, or quietly replace the queue with a fresh export. New arrivals belong to a separate intake unless Herb expands the scope.

Reconcile the frozen queue against a freshly paginated live bookmark list. The maintained export retains removed items. Skip verified prior removals, recording them as already absent without inventing a reason or claiming the agent removed them. Recheck live presence before presenting an item if the live state may have changed.

Never hand-edit the maintained vault exports `documents/X bookmarks.md` or `documents/x-bookmarks/bookmarks.json`. Save research artifacts outside those files. Preserve the frozen source too.

For the October 25, 2026 review, the frozen 145-item export is `C:\Users\herb\setup\bookmarks-review-2026-10-25.md` on the mini; its original Mac copy is `~/.local/share/x-bookmarks/bookmarks-2026-10-25.md`. These paths identify that campaign, not a permanent requirement for future queues.

### Research before presentation

Research the full post, author, quoted posts (including nested quotes), linked articles, images, and videos or talks before presenting the item. Prefer authenticated X API reads and primary sources. Do not infer a person's name from their handle or email; use a verified profile or their display name. Distinguish the author's claims, evidence, your assessment, and guesses about why Herb saved it.

- Prefer `note_tweet.text` to truncated `text`. Expand URL entities, including entities inside `note_tweet`. A normal read or oEmbed response may omit the long-post body.
- Fetch quoted posts directly as needed; expansions may omit nested quotes or their media. Request media variants and duration to find the actual video.
- For X Articles, obtain the actual full body. The parent post's `article` field can return `title` and `plain_text` with `tweet.fields=article`. A preview or title is insufficient. If API access fails, use signed-in Chrome under the applicable browser instructions. A failed public URL does not prove the article body is unavailable.
- Read linked article bodies, rather than relying on snippets, blurbs, or somebody else's summary. For a book announcement, verify the book and available formats; do not imply you have read the whole book.
- Inspect attached images, including text inside them. Obtain a transcript or a solid source-grounded summary of the actual video or talk. If transcribing locally, inspect relevant visual material too, preserve timestamps, and label machine-transcription uncertainty. Never substitute another similarly titled video.
- Check consequential or disputed claims against current primary evidence. Separate anecdotes, marketing, observational findings, and established results. Avoid both credulity and a ritual debunking tone.

If material is inaccessible, state the precise gap and keep the research incomplete. Do not fill it with a plausible guess. Respect source-reproduction limits when presenting content; link and clearly label any necessary summary instead of passing it off as the full source.

Background research may run ahead when authorized, but presentation and decisions remain one at a time. Reuse verified research and saved full bodies; do not repeatedly fetch or transcribe unchanged material just to demonstrate activity.

### Present and discuss

Always show the actual post inline before the brief, every time. Herb wants to see the post itself, not just a summary. For X, generate the card with [tweet-cards](../tweet-cards/SKILL.md) and pass its complete output unchanged; it includes the avatar, images, quoted posts and counts. For Bluesky, build the same kind of self-contained card from the bookmark JSON: author, avatar, handle, date, full text, images, link card, quoted post and a link to the original. Distinguish article summaries from the post itself.

Don't use the platforms' official embeds. X's `widgets.js`, Bluesky's `embed.js` and their iframe embeds (`platform.twitter.com/embed/Tweet.html`, `embed.bsky.app/embed/…`) can appear in an `html_preview` screenshot but show only blank space in Herb's live T3 view (tested 2026-11-09). A preview that looks right does not prove the post is visible to him.

In T3 Code, call `html_preview` and then `html_render` with the HTML. Follow the renderer's theme and layout rules. Do not start a server just to show the post.

Keep each turn in reading order: wrap-up of the previous bookmark, then the next card, then its discussion. T3 places a rendered card above the turn's final reply, so write the wrap-up (what was saved, removed and logged) as interim text before calling `html_render`, and put only the new bookmark's discussion in the final reply. Render the card in the same turn as the decision question, immediately before asking it, so Herb can see the bookmark while he answers; never ask about a bookmark whose card was shown only in an earlier turn.

Follow with a short explanation of what is useful and what is uncertain, including where you would file it if he chooses File, then ask for the decision with the question tool. Do not recite the whole research report or turn every reaction into a task proposal.

For reflective material, use [thinking-partner](../thinking-partner/SKILL.md). Herb wants sources to provoke his own thinking and contribute to a richly interlinked personal wiki or zettelkasten. A quote collection or read-later dump is not a substitute for his reflection. Preserve his uncertainty and distinguish his thoughts from the source and the agent's interpretation. Search existing notes before proposing additions, and make only meaningful connections.

### Capture in the right place

Use the destination Herb chooses. Interest alone does not authorize a task, purchase, signup, system change, or message to somebody else.

- Actual commitments or agreed actions: use the [tasks](../tasks/SKILL.md) skill and managed Tasks CLI, with its identity, receipt, and read-back checks. Do not use Google Tasks as a fallback.
- Long-form articles, essays, and other reading he wants to save for later: use the Matter CLI workflow above. Matter is the default destination for this choice; do not create a reading task or an Obsidian article-summary note just because he wants to read it. Research tied to an actual action can still support that action, and reflections belong in his personal knowledge base when agreed.
- Books he might read: his usual destination is Apple Books' **Want to Read** collection. Do not replace this with Tasks or a new vault reading list. Verify an app capture if making it yourself; if unavailable, provide the book link and wait for Herb's confirmation that he captured it.
- Shows he might watch: use his existing Obsidian TV shows note when requested. The existing note is `documents/archive/TV Shows.md`; confirm its current location and preserve its format. Do not create a watch task by default.
- Reflections: propose an addition to an existing note or a short connected idea note grounded in Herb's thoughts. Let him review before saving unless the specific write is already authorized. Do not manufacture a note or new taxonomy merely to empty the queue.
- Tool or workflow changes: discuss or investigate before installing or changing anything unless Herb has authorized the particular action.

For a snoozed action, distinguish an announced date from a chosen follow-up date. If ticket sales have no published date, say so; do not invent one. Preserve the source link and reason for the check.

### Standalone follow-up conversations

When Herb asks for a new agent session during this review, always create a standalone top-level session. Do not use a subagent or delegated child for a conversation he intends to have directly. This also applies to reflective discussions and involved investigations.

Give the session the source URL, relevant context, and saved research locations. For reflective sessions, explicitly invoke the thinking-partner skill and plain-chat questions. Have the conversation there, rather than relaying its questions into the bookmark review. Continue reviewing independently when Herb asks.

If Herb asks to send another source to an existing discussion, send it to that session rather than creating a duplicate. Read the thread as required by the tools before describing its state. Retain and share its exact returned link. Follow the current orchestration rules for launch, delivery, and waiting.

### Decisions, removal, and audit trail

Herb gives standing authorization to remove a bookmark once he makes its decision and any required capture or handoff succeeds. Do not ask a second “remove now?” question. An explicit discard needs no other capture. A request to start a discussion can resolve the bookmark once the session is created. If he explicitly wants to keep a bookmark, preserve it and record the keep decision.

A factual question, process correction, tentative reaction, or request to continue past an unresolved item is not automatically a removal decision. Clarify genuine ambiguity once. Record deferred items explicitly so they are not lost when the pointer advances. Never let the goal of draining the queue substitute for an individual decision.

Check the command result, then independently paginate the live bookmarks and verify the ID is absent. A successful idempotent unbookmark establishes the final state, not that this invocation caused a removal that had already happened. If the mini or verification is unavailable, record the approved action as pending and retry safely later; do not claim completion.

Record each decision, its reason in Herb's terms, source IDs/links, resulting note/task/session links, and actual verified action outcome in the review log. Preserve historical entries while clearly marking later decisions as superseding earlier pending proposals. Update the resume pointer and list unresolved/deferred items and pending removals.

At a handoff, keep the frozen queue, research artifacts, current pointer, standing preferences, and outstanding actions discoverable. An automatic goal continuation supplies no new user approval. Do useful independent preparation if available, then wait for the pending decision without repeatedly asking it or advancing the interactive review. Apply the goal system's blocked-state rules if applicable; completion requires every original item to have a recorded disposition or explicitly resolved handoff, with approved actions verified.
