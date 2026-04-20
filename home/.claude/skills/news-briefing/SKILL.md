---
name: news-briefing
description: "Synthesize a daily news briefing JSON document from a pre-fetched raw briefing file."
---

# Daily News Briefing

## Overview

The deterministic crawl/extract pipeline now lives in the `briefings` repo.

Use this skill only after a raw file already exists at:

- `~/Code/HerbCaudill/briefings/public/briefings/raw/YYYY-MM-DD.json`

Do not crawl source sites, fetch headlines, or extract article bodies here. The raw file already contains the candidate articles, source metadata, first-seen positions, sightings, and extracted body text.

## Input

Read the target raw file and synthesize a final briefing JSON document for the app.

## Output shape

Return a single JSON object:

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

## Rules

- Use the raw article bodies as the factual basis for summaries
- **3-5 stories per section** when enough source material exists
- Prioritize stories covered by **2+ sources** when possible
- **Exclude sports entirely**
- Each story `body` must be **one paragraph of plain text** with no markdown or links
- `sources[]` must point to the actual article URLs from the raw file
- Within each section, order by strength of coverage and significance
- **No emojis** anywhere in the output
- Output **only** the JSON object — no surrounding text or code fences
