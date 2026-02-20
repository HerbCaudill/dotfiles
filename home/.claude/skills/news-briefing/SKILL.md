---
name: news-briefing
description: "Generate a daily news briefing covering world news, US news, Spain, and Barcelona & Catalunya."
---

# Daily News Briefing

## Overview

Fetch headlines from international, US, Spanish, and Catalan news sites, cross-reference stories, and produce a concise daily briefing organized into four sections.

## Phase 1: Fetch headlines via curl

Use this script pattern for ALL sites. It handles encoding issues and extracts headline text from h2/h3 tags:

```bash
curl -s -L --max-time 15 \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  "URL" | python3 -c "
import sys, re
html = sys.stdin.buffer.read().decode('utf-8', errors='replace')
for tag in ['h2', 'h3']:
    for m in re.findall(r'<'+tag+r'[^>]*>(.*?)</'+tag+r'>', html, re.DOTALL)[:15]:
        t = re.sub(r'<[^>]+>', ' ', m).strip()
        t = re.sub(r'\s+', ' ', t)
        if len(t) > 15: print(t)
"
```

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

## Phase 2: Synthesize the briefing

Organize the briefing into four sections with these h2 headers, in this order:

1. `## World`
2. `## US`
3. `## Spain`
4. `## Barcelona & Catalunya`

Rules:

- **3-5 stories per section**
- Stories should appear in **2+ sources** (exception: Barcelona/Costa Brava stories can appear in fewer regional sources)
- **Exclude sports entirely**
- Each story is **one paragraph** with inline markdown links to the source sites
- Within each section, order by number of sources covering the story (most-covered first)
- Use the format: `**Headline summary.** Details and context. ([Source1](url), [Source2](url))`
- **No numbering** — do not prefix stories with numbers
- **No emojis** anywhere in the output
- **No h1 headings** — start with h2 (`##`) for section headers; the app renders the title and date
