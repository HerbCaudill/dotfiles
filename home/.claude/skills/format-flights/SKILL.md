---
name: format-flights
description: Use when the user pastes messy flight details (from airline sites, booking confirmations, emails) and wants them cleaned up, or when adding a new flight to an existing formatted itinerary. Trigger on "format these flights", "clean up this itinerary", or raw pasted flight data needing reformatting.
---

# Format Flights

Format messy flight information into a clean, consistent, text-only itinerary.

## Output Format

Each flight segment is grouped under its date. The date goes on its own line, followed by one line per flight leg. Separate groups with a blank line. Wrap the result in a code block so line breaks are preserved.

```
Day DD Mon YYYY
CODE → CODE · HH:MM – HH:MM · FLIGHT# · Class (if known)

Day DD Mon YYYY
CODE → CODE · HH:MM – HH:MM · FLIGHT# · Class (if known)
CODE → CODE · HH:MM – HH:MM · FLIGHT# · Class (if known)
```

## Rules

1. **Date line**: Abbreviated day, two-digit date, abbreviated month, four-digit year. Example: `Thu 30 Apr 2026`
2. **Flight line**: `ORIGIN → DEST · departure – arrival · airline+number · class`
   - Use the → character (Unicode arrow), not a hyphen or dash
   - Use a middle dot (·) as separator
   - Times in 24-hour HH:MM format, zero-padded
   - If the flight arrives the next day, append `+1` directly after the arrival time (e.g., `10:10+1`)
   - Include cabin class (Economy, Business, etc.) only if it was provided in the source data
   - Include flight number only if provided; if missing, try to look it up via web search
3. **Airport codes only**: Do not spell out city or airport names; the three-letter codes are sufficient.
4. **Connections on the same day**: List each leg on its own line under the shared date.
5. **Chronological order**: Sort flight groups by date.
6. **No extra commentary**: Output the formatted itinerary and nothing else (unless the user asks questions about it).
7. **Wrap in a code block**: Always wrap the final output in a fenced code block (```) so formatting is preserved in chat.
