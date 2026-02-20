#!/usr/bin/env python3
"""
Extract headlines and article URLs from a news site's HTML.
Reads HTML from stdin; takes the base URL as an argument.

Usage: curl -s "URL" | python3 extract_headlines.py "URL"
Output: one line per headline, formatted as "article_url | headline_text"
"""

import sys
import re
from urllib.parse import urljoin

base_url = sys.argv[1] if len(sys.argv) > 1 else ""
html = sys.stdin.buffer.read().decode("utf-8", errors="replace")

# Build an index of all <a> tag ranges and their hrefs.
# This lets us detect when an h2/h3 is wrapped inside a parent <a> tag.
a_tags = []
for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>', html):
    href = m.group(1)
    start = m.start()
    close = html.find("</a>", m.end())
    if close > 0:
        a_tags.append((start, close + 4, href))

# Build a map of aria-label text → href for "stretched link" patterns.
# Sites like The Guardian use an empty <a href="..." aria-label="headline"></a>
# next to the heading, so the <h3> is not inside the <a> tag.
aria_map = {}
for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*aria-label=["\']([^"\']+)["\'][^>]*>', html):
    aria_map[m.group(2).strip()] = m.group(1)
# Also match aria-label before href
for m in re.finditer(r'<a\b[^>]*aria-label=["\']([^"\']+)["\'][^>]*href=["\']([^"\']+)["\'][^>]*>', html):
    aria_map[m.group(1).strip()] = m.group(2)

seen = set()
for m in re.finditer(r"<(h[23])\b[^>]*>(.*?)</\1>", html, re.DOTALL):
    content = m.group(2)
    text = re.sub(r"<[^>]+>", " ", content).strip()
    text = re.sub(r"\s+", " ", text)
    if len(text) <= 15 or text in seen:
        continue
    seen.add(text)

    url = ""

    # Strategy 1: look for an <a href="..."> inside the heading
    href_match = re.search(r'href=["\']([^"\']+)["\']', content)
    if href_match:
        url = urljoin(base_url, href_match.group(1))

    # Strategy 2: check if this heading sits inside a parent <a> tag
    if not url:
        pos = m.start()
        for a_start, a_end, a_href in a_tags:
            if a_start < pos < a_end:
                url = urljoin(base_url, a_href)
                break

    # Strategy 3: match headline text against aria-label attributes
    if not url and text in aria_map:
        url = urljoin(base_url, aria_map[text])

    print(f"{url} | {text}")
