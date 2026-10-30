# Local vault search

QMD indexes the Obsidian vault for keyword and semantic retrieval. Agents use its CLI directly; no MCP server is required. Markdown remains authoritative. The index and model downloads are disposable machine-local state, not vault content or dotfiles assets.

## MacBook

Home Manager installs the `qmd` wrapper and generates `~/.config/qmd/index.yml` from `nix/home/qmd.nix`. The wrapper installs QMD 2.8.3 on first use into `~/.local/share/qmd`, preserving its native dependency layout. Node 22 or newer and npm must be available. The existing manual installation uses that same prefix and can be reused.

Apply with `pnpm nix:rebuild`. For the first migration, Home Manager may report the existing unmanaged `~/.local/bin/qmd` symlink and `~/.config/qmd/index.yml` as collisions. Move those two entries to unused backup names before applying; preserve their contents for comparison. Do not move or remove `~/.cache/qmd` while a QMD process has it open.

After applying, initialize or refresh the generated collection:

```sh
qmd update
qmd embed
qmd doctor
```

Initial embedding downloads a roughly 334 MB model. Hybrid search also downloads roughly 639 MB of reranking weights and 1.28 GB of query-expansion weights; `qmd pull` can download all three ahead of time. Do not run `qmd pull` and embedding concurrently during first-time downloads: they can collide over temporary model files. The MacBook's M3 Max Metal backend completed the original 12,610-passage index in about five minutes.

Collection and model configuration is managed by Nix. Change `nix/home/qmd.nix` and rebuild rather than using collection/context commands that rewrite the generated YAML. The same module owns LaunchAgent `com.herbcaudill.qmd-refresh`, which refreshes daily at 09:00 and at load. Launchd coalesces sleeping calendar runs on wake and never starts two instances of the same job. The shared runner also holds a process lock. It allows up to two hours on the Mac and logs to `/tmp/qmd-refresh.log`. Trigger it with `launchctl kickstart gui/$(id -u)/com.herbcaudill.qmd-refresh`; do not use `-k` to interrupt an active refresh.

## Search

```sh
qmd search "GSS" -c notes
qmd query "What have I written about capturing ideas on my phone?" -c notes
qmd query "vec: one button capture automatically classified into contacts and projects" --no-rerank -c notes
qmd get "qmd://notes/documents/Second brain.md"
qmd status
```

Use `--format json` for structured agent results. Read the current source note before relying on a passage and cite its path. Hybrid expansion and reranking can make results worse; compare direct semantic and keyword retrieval when relevance is poor. After notes change, run `qmd update` followed by `qmd embed`. A healthy `qmd doctor` reports current embeddings and reproduces sampled vectors.

## Mini

The mini has QMD 2.8.3 installed globally with npm. Vulkan initialization exited unexpectedly during setup, so scheduled refreshes use CPU mode, one embedding context and one document per batch. Check `qmd status` for pending work before treating semantic results as complete. From the mini, the MacBook is another option when awake:

```powershell
ssh mac 'qmd query "your question" -c notes'
```

To reproduce the Windows installation if needed:

```powershell
npm install -g @tobilu/qmd@2.8.3 --allow-scripts=node-llama-cpp,better-sqlite3,tree-sitter-go,tree-sitter-python,tree-sitter-rust,tree-sitter-typescript,tree-sitter-javascript
qmd collection add C:/Code/HerbCaudill/notes --name notes --mask '**/*.md'
qmd context add qmd://notes 'Personal Obsidian wiki belonging to Herb Caudill.'
```

The original mini installation needed `npm rebuild -g node-llama-cpp --allow-scripts=node-llama-cpp` after npm blocked its installation script. Setup persisted `QMD_FORCE_CPU=1` and `QMD_EMBED_PARALLELISM=1` in the mini's user environment; these are workarounds, not settings for the MacBook.

Dotfiles owns index maintenance on both machines, separate from Briefings and vault synchronization. This follows the mini's existing S4U task convention, using machine-wide PowerShell 7 and an explicit mise Node runtime. Register from an elevated shell with `scripts/windows/register-qmd-task.ps1`. Task `qmd-refresh` runs daily at 09:00, including after a missed start, with `MultipleInstances=IgnoreNew`. Run it now with `Start-ScheduledTask qmd-refresh`; inspect `Get-ScheduledTaskInfo qmd-refresh` and `~/.local/state/qmd/refresh.log` for completion or failure. Re-register after changing the selected Node installation.

The shared `scripts/qmd/refresh.ts` runner performs `qmd update` followed by `qmd embed --timeout 0`. QMD otherwise limits an embed session to 30 minutes. Mini's process runs at low priority, has a twenty-hour budget, defers starts from 06:00–09:00 local time, and kills only its own child process tree at the earlier of its budget or 06:00. The task has a separate 21-hour safety limit. This leaves at least an hour before the 07:00 briefing, even after a delayed task start. Completed batches remain indexed; the next refresh resumes pending work. Failures produce a nonzero task result and a timestamped log. The runner's PID lock prevents manual runner invocations from overlapping scheduled work, and dead-process locks are reclaimed. Do not bypass it with a concurrent manual embed.

Each machine has independent collection paths, source files and index freshness. A complete Mac index does not complete the mini's index. Vault synchronization is managed separately; QMD must not pull, stash, merge or resolve vault Git conflicts.
