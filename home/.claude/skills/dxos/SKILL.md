---
name: dxos
description: Use when working with, researching, or evaluating DXOS (local-first framework, ECHO database, Composer app). Covers the local clone, how to navigate the repo's design docs, current architecture, and in-flight migrations as of 2026-08.
---

# DXOS

Working knowledge of the DXOS monorepo, gathered from a full survey on 2026-08-29 (main at `0132aab498`, just after v0.11.1 / the v0.9.0 tag backfill). Verify anything load-bearing against the repo — this project moves at ~350 commits/month and renames public APIs freely.

## Local setup

- Clone: `~/Code/dxos/dxos`. Remotes: `dxos` (and `origin`) → github.com/dxos/dxos, `herbcaudill` → Herb's fork. Pull with `git pull dxos main --ff-only`.
- Huge pnpm monorepo: 118 packages under `packages/plugins`, 63 under `packages/ui`, plus `core/`, `sdk/`, `devtools/`, `e2e/`.

## How to navigate the repo (docs geography)

- **The live truth is `.agents/projects/`** — one directory per work-stream with `DESIGN.md` (decisions, dated and attributed) and `TASKS.md` (ledger opening with a `_Resume:_` line naming the exact PR and next step). `registry.yml` there indexes ~49 active projects with owners and PR lists.
- Package-level `DESIGN.md`/`AUDIT.md` files are current and high-value (e.g. `packages/plugins/plugin-projects/docs/`, `packages/core/halo/halo/MIGRATION.md`). `AUDIT.md` = point-in-time investigation, not durable design.
- `agents/superpowers/specs/` and `plans/` hold dated per-feature specs and semi-legacy plans (ECHO internals, queue→feed migration).
- **`docs/design/` is 2022-era archaeology** (KUBE/IPFS/Avalanche stack) and actively misleading about current architecture. Ignore it except `browser-globals.md` and `agentic-coding-on-cloudflare.md`.
- `REPOSITORY_GUIDE.md` (root) is the build/deploy/plugin-sets reference; `.github/RELEASE-SPEC.md` is the release design (Changesets, two lockstep groups, planned repo split in §6).

## Current architecture (2026-08)

- **Stack**: ECHO database on Automerge 3.x + SQLite (numbered `.sql` migrations; LevelDB removed), Cloudflare-based EDGE services, HALO identity, Effect 4 throughout, Composer as the app shell (web, Tauri desktop, iOS; curated plugin sets per target).
- **Product thesis**: agentic project work inside Composer, modeled on Claude Desktop projects. `Project` holds instructions, skills, routines, artifacts, chats. Work has two forms: markdown checklists (fluid) and ECHO `Task` objects in a `TaskSet` (durable/assignable); promotion between them is the agent-delegation moment. A supervisor loop spawns one sub-agent per ready task. MCP (`dx mcp serve`, `@dxos/mcp-server`) drives Composer objects from Claude.
- **`core/compute`** (pipelines, crawlers, extractors, semantic index, agent runtimes) is now the highest-churn area, having overtaken `core/echo`.

## In-flight migrations (expect churn here)

1. Effect 3 → 4: landed for the monorepo (#12521), edge repo following; on the pre-release line.
2. Hypercore removal / HALO → Keyhive (Ink & Switch capability layer): half-landed — credentials written to Automerge docs, client read path not yet flipped; no backwards compat. See `packages/core/halo/halo/MIGRATION.md` — probably the best third-party Keyhive writeup anywhere.
3. Queue → Feed: done through the RPC contract; `Feed` is the substrate for chat, email, triggers, transcription, with pluggable at-rest encryption.
4. protobufjs → buf + Effect RPC for client services; Hono/Effect-4 EDGE client.
5. Plugin entrypoints becoming serializable data (`dxplugin.jsonc`); `echo-db` splitting into `echo-client`/`echo-host`.

## Naming instability

Renames are constant; search both forms: Queue→Feed, ObjectId→EntityId, ObjectMeta→EntityMeta, echo-pipeline→echo-host, Automation→Routine, plugin-sketch→plugin-tldraw, plugin-feed→plugin-magazine, fill→bg / foreground→fg (theme roles), nightly→preview (env).

## Development culture (context for reading history/PRs)

- ~95% of commits are agent-co-authored since mid-2026; team is effectively four people (Rich Burdon — product/UI surfaces, Josiah Witt — CI/ECHO/app-shell, Dmytro Maretskyi — protocol/compute/deps, Mykola Veremchuk — EDGE/testing).
- Commit style is `scope: full sentence (#PR)`, not conventional commits (abandoned Jul 2026).
- 150+ open PRs, many abandoned; branches are `claude/<topic>-<hash>` worktrees. Don't trust an open PR as a signal of active work — check the branch date and `.agents/projects` resume notes.
- Performance is budget-enforced in CI: static boot size ≤4.75 MB, runtime modules-at-ready ≤300.

## Releases

Changesets since Jul 2026 (was release-please). Core/SDK and plugins+CLI version in lockstep groups; Composer app ships on fast channels (v0.10.0 → v0.11.1 in eight weeks). There was an 11-month gap between v0.8.3 (Jul 2025) and v0.9.0 (Jun 2026).
