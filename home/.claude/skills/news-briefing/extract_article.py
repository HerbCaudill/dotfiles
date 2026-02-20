#!/usr/bin/env python3
"""
Extract article body text from a news article's HTML.
Reads HTML from stdin.

Usage: curl -s "ARTICLE_URL" | python3 extract_article.py
Output: article paragraphs as plain text, capped at ~3000 characters.
"""

import sys
import re

html = sys.stdin.buffer.read().decode("utf-8", errors="replace")

# Prefer content inside an <article> tag if present
article = re.search(r"<article\b[^>]*>(.*?)</article>", html, re.DOTALL)
content = article.group(1) if article else html

total = 0
for p in re.findall(r"<p\b[^>]*>(.*?)</p>", content, re.DOTALL):
    text = re.sub(r"<[^>]+>", " ", p).strip()
    text = re.sub(r"\s+", " ", text)
    if len(text) > 40:
        print(text)
        total += len(text)
        if total > 3000:
            break
