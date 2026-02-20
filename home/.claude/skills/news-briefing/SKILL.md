---
name: news-briefing
description: "Generate a daily news briefing for Spain, Barcelona, and the Costa Brava from local news sources."
---

# Daily News Briefing — Spain, Barcelona & Costa Brava

## Overview

Fetch headlines from Spanish and Catalan news sites, cross-reference stories, and produce a concise daily briefing of 5-10 major stories.

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

**Important:** Do NOT use WebFetch — most Spanish news sites block it. Use curl via Bash.

Run in **3 batches** of parallel Bash calls (more than ~5 parallel calls causes sibling errors):

### Batch 1 — National Spain

- https://elpais.com/espana/
- https://www.elmundo.es/espana.html
- https://www.rtve.es/noticias/espana/
- https://www.lavanguardia.com/
- https://www.elperiodico.com/es/

### Batch 2 — Barcelona

- https://www.3cat.cat/3catinfo/
- https://beteve.cat/
- https://www.3cat.cat/3catinfo/barcelona-ciutat/
- https://www.totbarcelona.cat/
- https://www.elperiodico.com/es/barcelona/

### Batch 3 — Costa Brava & extras

- https://www.diaridegirona.cat/baix-emporda/
- https://www.emporda.info/tags/palafrugell/
- https://www.thenewbarcelonapost.cat/
- https://www.diaridebarcelona.cat/

## Phase 2: Synthesize the briefing

From the collected headlines, produce a briefing with these rules:

- **5-10 stories** that appear in **2+ sources** (exception: Costa Brava stories can appear in fewer regional sources)
- Focus on **Spain, Barcelona, and Costa Brava**
- **Exclude sports entirely**
- Each story is **one paragraph** with inline markdown links to the source sites
- Order by number of sources covering the story (most-covered first)
- Use the format: `**N. Headline summary.** Details and context. ([Source1](url), [Source2](url))`
- Title the briefing with today's date
