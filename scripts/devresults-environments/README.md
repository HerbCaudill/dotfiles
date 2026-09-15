# Personal environment internal contracts

These modules implement the identity foundation of the personal `drenv` command. The lifecycle command handlers and installer are delivered by dependent tasks. All tooling remains in dotfiles. Existing `dr`, `drsync`, DevResults tracked files, primary worktrees and shared catalogs retain their existing behavior.

## Public command surface

`parseDrenvArgs(argv)` accepts `create <id> [--preset default|inl] [--revision <git-ref>] [--database <catalog>] [--instance <name>]`, `sync <id>`, `start <id>`, `status [id]`, `url <id>`, `open <id>`, `stop <id>`, `snapshot <id>`, `reset <id>` and `remove <id>`. Missing commands and `--help` return the help command. Unknown and duplicate options fail before side effects. Creation always starts on Mac. Every mutating operation requires an explicit environment identity; current directories and branch names never select a Windows destination.

`default` selects read-only source `dev` / `example`; `inl` selects `dev-inl` / `inl`. Explicit database and instance arguments override the chosen preset. Create also accepts `--source <native-mac-checkout>` and `--snapshot <coordinated-snapshot-receipt>`; the source and provisioning workers respectively validate these inputs and checkpoint their own receipts. A revision selector defaults to `HEAD` in the explicitly selected source checkout. Source pairing resolves it once into a full commit SHA. Later `sync` transports a freshly verified source commit only to the recorded destination and checkpoints the new SHA.

## Identity and storage

`getRegistryOptions()` owns canonical defaults: `~/.local/state/drenv`, native Mac worktrees below `~/Code/DevResults/environments`, Windows source below `C:\DevResultsEnvironments\source`, runtime state below `C:\DevResultsEnvironments\runtime`, and SSH alias `devresults-vm`. The configuration is injectable in tests. Mounted Windows paths and relative roots are refused.

`types.ts` is the shared schema. `EnvironmentManifest` has `version: 1`, stable `id`, random `ownerToken`, timestamps, phase, verified `completedSteps`, preset, read-only source data, requested revision and optional frozen commit, Windows host, native paths, owned SQL `catalog`, and proposed ports. Runtime workers derive their private IIS, SQL files, Azurite, cache, temp, mail and process-state paths below `paths.runtime`. Store extra runtime receipts in that owned directory instead of independently editing `registry.json`. Credentials, connection strings with passwords and raw command output must never enter the manifest.

`createRegistry(options)` exposes `list()`, `get(id)`, `reserve(input)`, `checkpoint(id, ownerToken, checkpoint)` and `assertOwnership(id, observedMarker)`. Every read validates the full mapping and refuses unsupported schemas, invalid IDs, duplicate identities/tokens/catalogs, overlapping source/runtime paths, ports shared between environments, or paths/hosts outside the configured roots. Mac paths are compared conservatively without case distinctions for collision detection. Device names such as `con` are invalid IDs.

`reserve` persists before any external mutation. Repeating identical creation arguments returns the same ID, token, paths and ports; conflicting arguments fail. A removed environment retains a tombstone and its reservations to avoid accidentally adopting leftover resources. Reuse and garbage collection are intentionally separate future operations. Registry transactions use a same-filesystem atomic rename and a private filesystem directory lock shared across CLI processes.

## Allocation and ownership

Reservation requires a fresh `ResourceInventory`: `windowsPorts` includes listeners, HTTP.sys SSL bindings and URL reservations, and existing personal host claims; `macPorts` includes listeners and personal claims. The allocator excludes these and established primary/e2e/Vibe/report/Azurite endpoints. It searches dynamically from 20000 through 65535 for six distinct endpoints and persists them under the registry lock. It has no fixed lane count. The current Windows host has many HTTP.sys bindings without matching TCP listeners; listener-only discovery is insufficient.

**A registry reservation is a proposal, not proof of live Windows ownership.** The Windows provisioning worker must take one host-wide allocation lock, inspect existing personal claims and actual resource ownership again, then durably claim all ports and paths before mutation. On collision it must refuse with the conflicting resource and leave a resumable failure; it must never seize an endpoint or silently use another environment. This second lock is essential because unrelated Windows processes cannot participate in the Mac registry transaction. SQL catalogs and every filesystem/process resource require the same preflight principle.

Before mutating an existing resource, compare an observed marker `{ environmentId, ownerToken }` against the manifest through `assertOwnership`, and verify the resource's native path/catalog/port/process identity independently. Missing markers are foreign ownership, not permission to adopt. Markers alone do not authorize deleting arbitrary paths or killing reused PIDs. Create a marker only when exclusive creation proves the resource was absent; an existing primary or foreign resource must fail. Registry tokens identify ownership, and are not an authentication mechanism against a malicious local user.

## Lifecycle and recovery

Wrap each full create/sync/start/stop/snapshot/reset/remove operation in `withEnvironmentLock(registry.directory, id, operation)`. This lock is distinct from the short registry transaction lock, so a handler may safely call registry methods inside it. Other environments can progress concurrently. Windows must also serialize remote operations and protect host-wide allocation independently.

After verifying an external effect, call `checkpoint` with its new phase and an idempotent `completedStep`. Allowed phase names are `reserved`, `source-ready`, `provisioned`, `running`, `stopped`, `failed` and `removed`. The registry validates the phase name and ownership; handlers enforce the actual prerequisites and perform the verification before checkpointing. A failure preserves previous completed steps and resource allocations. Retrying must inspect the live resource and its receipt before treating a previously incomplete step as done. A successful checkpoint clears the prior failure message. Removal is terminal and should be recorded only after verified owned cleanup.

Locks include owner PID and timestamp. Timeouts explain the lock location and never steal a lock automatically. If a process crashed, inspect the recorded PID and live process identity, prove it no longer owns an operation, and recover that exact stale lock explicitly. Do not remove active locks or runtime files. An interrupted Windows mutation requires Windows-side recovery evidence even if the Mac process is gone.

## Safe execution and worker boundaries

`runDrenvCommand` executes literal local argument arrays with no shell, bounded time and output, and optional private stdin. Failures omit arguments, stdin and child output to keep credentials out of diagnostics. This helper handles short commands; complete process-tree supervision belongs to the lifecycle runner. Its timeout does not prove that a remote operation or a descendant has stopped. Windows workers must journal and supervise remote mutations themselves.

SSH passes commands through a remote shell even when the local process is shell-free. Use versioned personal PowerShell payloads, encoded PowerShell commands and serialized data on stdin or equivalently safe transport. Never concatenate environment IDs, paths, source values or credentials into executable PowerShell. Remote operations must use `devresults-vm`, never Mac filesystem access to a mounted Windows checkout.

Source worker ownership: add pairing/sync modules and source tests alongside these contracts. Provisioning worker ownership: add Windows payloads and runtime provisioning modules/tests. Neither worker should change core registry/types/CLI files concurrently; coordinate necessary shared changes first. Lifecycle integration composes these modules after independent review of both workers.

## Verification boundary

The foundation tests verify serialized allocation, stable retry identity, data presets, argument validation, foreign-resource refusal, corrupt mappings, literal process arguments, safe error messages and lock recovery behavior. They do not claim Windows runtime or SQL integration. Live creation must separately establish adequate disk capacity, SQL/blob snapshot consistency, IIS/HTTP.sys permissions, runtime dependencies and cross-environment survival. Never report those checks as passed based on unit tests.
