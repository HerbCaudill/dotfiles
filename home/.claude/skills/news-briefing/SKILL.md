---
name: news-briefing
description: "Generate a daily news briefing covering world news, US news, Spain, and Barcelona & Catalunya."
---

# Daily News Briefing

## Overview

Fetch headlines and article URLs from news sites, read the top articles for each story, cross-reference, and produce a concise daily briefing organized into four sections.

## Phase 1: Fetch headlines and article URLs

For each site, use curl piped to the extraction script:

```bash
curl -s -L --max-time 15 \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  "SITE_URL" | node ~/.claude/skills/news-briefing/extract_headlines.ts "SITE_URL"
```

Replace `SITE_URL` with the actual URL. Output is `article_url | headline_text` per line.

**Important:** Do NOT use WebFetch — most news sites block it. Use curl via Bash.

Run in **5 batches** of parallel Bash calls (more than ~5 parallel calls causes sibling errors):

### Batch 1 — World news (non-US sources)

- https://www.bbc.com/news
- https://www.theguardian.com/world
- https://www.reuters.com/world/
- https://www.aljazeera.com/
- https://www.france24.com/en/

### Batch 2 — US news

- https://www.nytimes.com/section/us
- https://www.washingtonpost.com/national/
- https://apnews.com/us-news
- https://www.politico.com/

### Batch 3 — Spain

- https://elpais.com/espana/
- https://www.elmundo.es/espana.html
- https://www.rtve.es/noticias/espana/
- https://www.lavanguardia.com/
- https://www.elperiodico.com/es/

### Batch 4 — Barcelona

- https://www.3cat.cat/3catinfo/
- https://beteve.cat/
- https://www.3cat.cat/3catinfo/barcelona-ciutat/
- https://www.totbarcelona.cat/
- https://www.elperiodico.com/es/barcelona/

### Batch 5 — Costa Brava & extras

- https://www.diaridegirona.cat/baix-emporda/
- https://www.emporda.info/tags/palafrugell/
- https://www.thenewbarcelonapost.cat/
- https://www.diaridebarcelona.cat/

## Phase 1.5: Deduplicate against previous briefing

Before selecting stories, read yesterday's briefing JSON from the output directory (the most recent `.json` file). Extract all story headlines.

When selecting stories in Phase 2, **drop any story that already appeared in the previous briefing** unless there is a genuinely significant new development (e.g. a missing person was found, a vote passed, charges were filed, a new phase began). Continuing coverage of the same situation with no material change does not count — replace it with a fresh story. When in doubt, pick a different story.

## Phase 2: Identify top stories

Review all headlines from Phase 1. For each section (World, US, Spain, Barcelona & Catalunya):

1. Group headlines covering the same story across sources
2. Filter out stories that appeared in the previous briefing (see Phase 1.5)
3. Select 3-5 stories, prioritizing those appearing in 2+ sources
4. For each selected story, pick 1-2 article URLs to fetch (prefer sources that returned URLs; for English sections prefer English-language sources)

### Section scope — assign stories by topic, not by source

A story's section is determined by **what the story is about**, not which source published it. US news sites cover international stories; Spanish papers cover world events. Assign each story to the correct section based on its subject matter:

- **World**: International events outside the US and Spain (geopolitics, conflicts, international agreements, etc.)
- **US**: Stories about events, politics, and policy **within the United States** — domestic politics, federal/state policy, US court rulings, US economy, etc.
- **Spain**: National Spanish news — politics, economy, society, events happening across Spain
- **Barcelona & Catalunya**: Local/regional stories specific to Barcelona, Catalunya, Costa Brava, and surrounding areas

If a US source runs a story about Hong Kong, that's a World story. If El País covers a US election, that's a US story. Route by subject, not source.

## Phase 3: Fetch article content

For each selected article URL (~15-20 total), fetch and extract the article text:

```bash
curl -s -L --max-time 15 \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  "ARTICLE_URL" | node ~/.claude/skills/news-briefing/extract_article.ts
```

Run in batches of 5 parallel calls.

## Phase 4: Synthesize the briefing

Using the article content from Phase 3, output a single JSON object:

```json
{
  "sections": [
    {
      "title": "World",
      "stories": [
        {
          "headline": "Story headline",
          "body": "Details and context based on article content, one paragraph, no markdown.",
          "sources": [
            { "name": "BBC News", "url": "https://www.bbc.com/news/articles/abc123" },
            { "name": "Al Jazeera", "url": "https://www.aljazeera.com/news/2026/..." }
          ]
        }
      ]
    }
  ]
}
```

Section titles in order: `World`, `US`, `Spain`, `Barcelona & Catalunya`.

Rules:

- **3-5 stories per section**
- Stories should appear in **2+ sources** (exception: Barcelona/Costa Brava stories can appear in fewer regional sources)
- **Exclude sports entirely**
- Each story `body` is **one paragraph of plain text** — no markdown, no links
- Story body should be based on the **actual article content** fetched in Phase 3, not generated from headline text alone
- Source URLs must be the **actual article URLs** extracted in Phase 1, not site homepages
- Within each section, order by number of sources covering the story (most-covered first)
- **No emojis** anywhere in the output
- Output **only** the JSON object — no surrounding text or code fences
