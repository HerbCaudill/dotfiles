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

The mini has QMD 2.8.3 installed globally with npm. The Radeon 780M can run embeddings through Vulkan with cooperative matrices disabled: `GGML_VK_DISABLE_COOPMAT=1`. Keep one embedding context and one document per batch. The refresh runner sets these options explicitly. The scheduled refresh task runs daily at 09:00; see the 2026-11-01 investigation below for its history. Check `qmd status` for pending work before treating semantic results as complete. From the mini, the MacBook is another option when awake:

```powershell
ssh mac 'qmd query "your question" -c notes'
```

To reproduce the Windows installation if needed:

```powershell
npm install -g @tobilu/qmd@2.8.3 --allow-scripts=node-llama-cpp,better-sqlite3,tree-sitter-go,tree-sitter-python,tree-sitter-rust,tree-sitter-typescript,tree-sitter-javascript
qmd collection add C:/Code/HerbCaudill/notes --name notes --mask '**/*.md'
qmd context add qmd://notes 'Personal Obsidian wiki belonging to Herb Caudill.'
```

The original mini installation needed `npm rebuild -g node-llama-cpp --allow-scripts=node-llama-cpp` after npm blocked its installation script. Setup persisted `QMD_FORCE_CPU=1` and `QMD_EMBED_PARALLELISM=1` in the mini's user environment. The CPU workaround is superseded by the Vulkan workaround below; these are mini settings, not settings for the MacBook.

Dotfiles owns index maintenance on both machines, separate from Briefings and vault synchronization. This follows the mini's existing S4U task convention, using machine-wide PowerShell 7 and an explicit mise Node runtime. Register from an elevated shell with `scripts/windows/register-qmd-task.ps1`. Task `qmd-refresh` runs daily at 09:00, including after a missed start, with `MultipleInstances=IgnoreNew`. Run it now with `Start-ScheduledTask qmd-refresh`; inspect `Get-ScheduledTaskInfo qmd-refresh` and `~/.local/state/qmd/refresh.log` for completion or failure. Re-register after changing the selected Node installation.

The shared `scripts/qmd/refresh.ts` runner performs `qmd update` followed by `qmd embed --timeout 0`. QMD otherwise limits an embed session to 30 minutes. Mini's process runs at low priority, has a twenty-hour budget, defers starts from 06:00–09:00 local time, and kills only its own child process tree at the earlier of its budget or 06:00. The task has a separate 21-hour safety limit. This leaves at least an hour before the 07:00 briefing, even after a delayed task start. Completed batches remain indexed; the next refresh resumes pending work. Failures produce a nonzero task result and a timestamped log. An exclusive bind on `127.0.0.1:37739` prevents manual runner invocations from overlapping scheduled work; the OS releases it when the worker exits, including crashes. It serves no requests. Do not bypass it with a concurrent manual embed. Windows Task Scheduler can stop its PowerShell host without stopping Node descendants; confirm the specific refresh process tree has exited before manual database maintenance.

The 2026-10-30 mini backfill reused complete Mac embedding batches only where content hashes, QMD 2.8.3, the model URI, formatting fingerprint and 768-dimensional vectors matched. It preserved mini's own documents and collection paths, backed up the mini database, and imported through QMD's transactional embedding API. Routine refreshes remain independent and local; no cross-machine service is required. Both jobs completed with exit code 0 and no pending embeddings. Direct semantic retrieval for `a mobile inbox that files spoken ideas into contact records` returned `Second brain` first. Mac `qmd doctor` reproduced all three sampled vectors; mini reported small CPU-versus-Metal differences for all three samples (first cosine distance 0.000737), despite matching fingerprints and relevant semantic results. Exact CPU reproducibility would require a full local re-embed; the backfill does not claim that check passes. The Mac LaunchAgent uses standard process policy with CPU niceness and low-priority IO: background process policy stalled Metal shader initialization in the first acceptance run.

QMD status's `Updated` value comes from the latest indexed document modification time, not the last maintenance run. Use the timestamped `QMD refresh completed` log entry and scheduler exit result to confirm a recent scan.

Each machine has independent collection paths, source files and index freshness. A complete Mac index does not complete the mini's index. Vault synchronization is managed separately; QMD must not pull, stash, merge or resolve vault Git conflicts.

### Mini Vulkan investigation, 2026-11-01

QMD 2.8.3 bundles node-llama-cpp 3.20.0 and llama.cpp b10361. The Radeon 780M driver is AMD 24.20.11.04, WMI version `32.0.12011.4002`, dated 2024-10-14. Vulkan detects `KHR_coopmat`, loads all 25 embedding-model layers, and creates the context. With cooperative matrices enabled, the first `getEmbeddingFor` terminates the native process without a JavaScript exception. The original Git Bash probe reported 127; direct PowerShell reproductions reported 9. Neither number by itself establishes the native fault. The debug log ends after the embedding output buffer is resized, without a device-lost or allocation error.

Setting `GGML_VK_DISABLE_COOPMAT=1` makes the same standalone probe finish cleanly. Disabling FP16 alone still fails. This isolates the failure to the cooperative-matrix path on this backend/driver combination; it does not establish whether the underlying defect is in the driver, shader compiler, or llama.cpp. The [b10361 Vulkan source](https://github.com/ggml-org/llama.cpp/blob/b10361/ggml/src/ggml-vulkan/ggml-vulkan.cpp) checks this environment variable before enabling `VK_KHR_cooperative_matrix`. A driver update is unnecessary for this workaround, and none was installed.

The original 20 short embeddings completed in 1.26 seconds with the workaround. A separate GPU run completed 60 embeddings in 18.44 seconds, using a 2,048-token context and inputs of 14, 1,618, and 1,108 tokens. All vectors had 768 finite components and all 25 layers remained on the GPU. These are small diagnostic runs under existing memory pressure, not an index-throughput benchmark. Probe scripts and outputs remain in `%TEMP%\qp`; they do not open the production database.

The same three inputs produced CPU-versus-GPU cosine distances of 0.000399, 0.000376, and 0.000289. A long CPU comparison was stopped after about two minutes to limit resource use; a separate three-input CPU comparison completed in 66.54 seconds. The real refresh runner then completed `update` and `embed` against `%TEMP%\qp\test.sqlite`, with an isolated `QMD_CONFIG_DIR`: five chunks from two documents, exit 0. Direct semantic search put `capture.md` first, and `qmd doctor` confirmed Vulkan offloading, current fingerprints, and exact reproduction of all three sampled chunks. The existing lock and cutoff tests also passed.

Mini's user environment now has `QMD_LLAMA_GPU=vulkan`, `GGML_VK_DISABLE_COOPMAT=1`, and `QMD_EMBED_PARALLELISM=1`; the persisted `QMD_FORCE_CPU=1` was removed. Existing agent hosts and shells retain inherited variables until restarted. For an existing PowerShell session, use the following before QMD commands. The scheduled runner explicitly overrides the old CPU setting, so it does not depend on refreshing the scheduler's inherited environment.

```powershell
$env:QMD_FORCE_CPU = $null
$env:QMD_LLAMA_GPU = 'vulkan'
$env:GGML_VK_DISABLE_COOPMAT = '1'
$env:QMD_EMBED_PARALLELISM = '1'
```

The production database was backed up through SQLite's backup API to `C:\Users\herb\.cache\qmd\backups\20261101-before-vulkan\index.sqlite` before disposable-index validation. No production update, cleanup, or re-embed was run. Existing vectors include the earlier Metal import and subsequent CPU batches. GPU arithmetic can change vectors slightly even with the same model and fingerprint, so scores and close rankings can change. Completing only the pending documents preserves that mixed history. A full `qmd embed --force` would replace all vectors with local Vulkan results and give indexing and queries the same backend; run it only after explaining this tradeoff to Herb, confirming the e2e hold is released, checking for an active embed, and taking a fresh backup. Use `qmd doctor` and a known semantic query afterward.

### Refresh task pause, November 1–9

The task was deliberately disabled at 10:47 local time on 2026-11-01 to release resources for DevResults e2e work. The earlier coordinator transcript records Herb's approval and says QMD must stay paused until e2e finishes. The process-exit receipt at `C:\Users\herb\lean-evidence\qmd-completion-boundary-20261101-080118-v2\result.json` records the embedding processes ending at `09:47:08Z`; the task file changed at 10:47:05 local time. Result `267014` (`0x41306`, terminated) therefore reflects the approved stop, not a successful refresh or evidence of an automatic memory kill. Task Scheduler's Operational log was disabled, so it cannot supply an independent event history for that run.

The previous overnight run reached its intended 06:00 cutoff. The 09:00 run indexed successfully, reported 2,701 pending hashes, and was stopped before completion; the investigation found 2,582 pending documents and 20,091 embedded chunks. Completed batches survived. The runner uses Vulkan with the workaround; its lock, one-context/one-document limits, low priority, and 06:00 cutoff remain in place. Herb re-enabled the task on 2026-11-09, and a run started at 16:10 local time. After AMD driver 32.0.32015.7029 (Adrenalin 26.10.1) was installed that day, `qmd doctor` confirmed Vulkan offloading on the 780M with the same cooperative-matrix workaround, and the run embedded about 25 documents a minute.

### Memory findings

At about 21:04 local time, the mini had 29.8 GiB of usable RAM and about 2.6 GiB available, with 49.7 GiB committed. `Win32_PageFileUsage` reported 4,405 MiB actually in the pagefile, with a 5,099 MiB peak and 25,895 MiB allocated. The earlier roughly 49 GB figure describes commit, not measured swap use. Paging was active during inspection, but there is no retained morning memory trace that proves its effect on the stopped refresh.

Windows kernel pools accounted for about 8.0 GiB nonpaged and 7.9 GiB paged. A read-only `NtQuerySystemInformation(SystemPoolTagInformation)` probe found the largest allocations under `File` (6.18 GiB nonpaged, about 16.6 million outstanding objects), `FMfn` (2.80 GiB paged), `Ntfc` (1.23 GiB paged), and `IoNm` (1.16 GiB paged). These point to file objects and filesystem/filter name bookkeeping. They do not identify which process or filter retains the references. The machine had been up since 2026-10-27. Attributing this retention to a particular driver or application needs a separate handle/reference or kernel-trace investigation; the AMD graphics driver has not been established as its cause.

Application private memory also contributed: 34 Node processes totaled about 9.7 GiB, including the Tasks Vite server (2.44 GiB) and the DevResults design-refresh Vite build watcher (2.31 GiB). Seven IIS Express processes totaled 3.54 GiB, Chrome 2.11 GiB, Notepad 1.94 GiB, ChatGPT 1.78 GiB, three Claude processes 1.68 GiB, and SQL Server 1.44 GiB. Private commit and working set are different measures and must not be added together. No shared process or service was stopped, restarted, or modified. Memory pressure plausibly slowed CPU embedding, but the documented reason for the morning termination was the e2e resource hold.
