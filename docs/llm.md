# Headless LLM calls

`llm` runs a prompt without the caller naming a model. Callers say how much intelligence they need, from 0 to 100, and it picks the cheapest variant that gets there. A variant is a harness, a model and an effort level.

```bash
llm run --level 75 --schema result.json < prompt.md
llm run --level 95 --sandbox workspace-write --cwd ~/Code/HerbCaudill/leo < prompt.md
llm resolve --level 50 --harness codex
llm frontier
llm refresh
```

The prompt comes from standard input and the final message goes to standard output. The sandbox defaults to `read-only`.

## How a level becomes a model

Level 0 maps to the floor and level 100 to the top score across all harnesses. The target is the point that far along the range, and the pick is the cheapest variant at or above it. If `--harness` limits the choice and that harness can't reach the target, the pick is its highest-scoring variant.

The floor is the lowest score on the frontier when the scale is first set, and it stays there. Weaker models that appear later are ignored. It resets only when Artificial Analysis changes `intelligence_index_version`, because scores across versions aren't comparable.

If a run hits a usage limit, `llm` retries the same level on another harness and logs the change. A pinned harness doesn't fall back, and other failures don't either.

## The nightly refresh

`llm refresh` runs at 03:30 through the `llm-refresh` LaunchAgent on the Mac and the `llm-refresh` scheduled task on the mini. It logs to `~/.local/state/llm/refresh.log`.

It fetches the Artificial Analysis free API, keeps the variants our harnesses can run, and makes a small test call on any variant that could be picked and hasn't passed yet. A variant that fails is dropped until the next night. A usage limit ends the refresh and keeps the previous scores. The morning briefing's `leo` lane reports scores older than three days.

Scores are saved in `~/.local/state/llm/frontier.json` on each machine and never committed. This repo is public, and the free API tier is for internal use with no redistribution. Data comes from [Artificial Analysis](https://artificialanalysis.ai/), which requires that attribution.

The key is in `~/.config/llm/artificial-analysis-key`, readable only by Herb's account.

## Adding a harness

Write an adapter in `scripts/llm/harnesses.ts` and list it in `HARNESSES`. An adapter says which models it can run, how to build its command from a request, and how to read its final message.
