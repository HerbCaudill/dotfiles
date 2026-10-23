# Native mini environments

`drenv --host mini` controls native Windows environments from either the mini or the Mac. The mini owns the registry and all lifecycle requests. Existing `devresults-vm` environments retain their paired Mac/Windows workflow.

## Installation

From elevated SSH on the mini, run the versioned installer after updating the dotfiles clone:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Code\HerbCaudill\dotfiles\scripts\devresults-environments\windows\install-mini.ps1
```

The installer refuses foreign resources. It creates `C:\DevResultsEnvironments`, protects it for Herb, Administrators and SYSTEM, installs `%USERPROFILE%\.local\bin\drenv.cmd`, and registers `drenv mini controller` at startup. It also installs an owned pinned Azurite through a limited S4U task. Check `install-tools.log` and the tools task's last result before provisioning. Invoke the `.cmd` by its full path if the current shell has not picked up `.local\bin` on PATH.

Use `-Update` to move an existing owned controller to the current code. Update refuses active request workers, stops its own controller before rewriting its launcher, and retains the existing tool installation. Do not update executable files while one of their workers is running. The installer does not change the primary site, e2e tasks, source checkout settings or migration notes.

## Create and use a stack

```sh
drenv --host mini create my-change --source 'C:\Code\DevResults\devresults' --snapshot 'C:\DevResultsEnvironments\snapshots\dev-20260916\snapshot.json' --vibe-source 'C:\Code\DevResults\viberesults'
drenv --host mini start my-change
drenv --host mini status my-change
drenv --host mini url my-change
```

Native mini commands default to mini; use `%USERPROFILE%\.local\bin\drenv.cmd` there. `DRENV_HOST` can select a persistent default. Mac callers use Windows paths for both source checkouts and the snapshot receipt. Creation freezes the selected committed revisions and leaves the stack provisioned/stopped. It does not include uncommitted changes from the source checkouts. `--revision` and `--vibe-revision` select explicit initial refs; omitting `--vibe-source` creates a legacy-only environment.

Each stack has an editable legacy worktree at `source\<id>`, an optional VibeResults worktree at `vibe\<id>`, and its own deployment/data under `runtime\<id>`. Both source worktrees use private Git stores beside them. VibeResults has its own dependency tree, writable caches, `.cert` copy and `.env.local` copy. Its scheduled process receives the owned `DEVRESULTS_ORIGIN` and `APP_HTTPS_PORT`, overriding copied defaults.

Commit legacy source changes, then use `sync <id>` to rebuild and reconcile its private deployment/schema. It leaves the stack stopped; `start <id>` starts legacy first and VibeResults second. For legacy browser-source edits, `watch <id>` starts a limited scheduled watcher, publishes successful Vite builds without restarting IIS, and returns once the initial build is published. Keep it running through review. Lifecycle operations stop it before rebuilding or changing data. After a watch overlay, use sync before a fresh verified deployment/start. VibeResults uses its regular live dev server and allows ordinary source edits. For committed VibeResults dependency changes, use `install-vibe <id>` explicitly and then start. Explicit install also repairs dependencies when the lockfile is unchanged; it drains the owned frontend and runs the limited installer. Start never installs dependencies or changes a worktree revision.

`status <id>` includes actual backend, VibeResults and client-watch state, current frontend revision and private log paths. A failed frontend start does not claim the whole stack is running. `stop` drains the frontend workers before IIS. Removal checks both worktrees for edits and validates legacy ownership before deleting the optional frontend. Removed IDs remain tombstones; choose a new ID for a new stack.

## Mac viewing

`url <id>` returns both origins and exact commands. For example:

```sh
ssh -N -L 127.0.0.2:30000:127.0.0.1:30000 -L 127.0.0.1:30006:127.0.0.1:30006 mini
```

Then visit `https://example.devlocal.us:30000` and `https://example.viberesults.dev:30006`. Use the actual assigned ports. Legacy redirects can include the IIS port, so forward it unchanged. On the Mac, `*.devlocal.us` resolves to `127.0.0.2`, while `*.viberesults.dev` resolves to `127.0.0.1`; bind each forward to its matching address. The browser must trust their existing certificates. Check occupied local ports before opening a tunnel. A tunnel is only transport; closing it leaves the stack running. The portless primary `https://<instance>.devlocal.us` route is separate: its managed Mac tunnel forwards `127.0.0.2:443` to primary IIS on mini loopback port `8443`. Tailscale keeps its own port `443`. Never send an isolated environment’s allocated port to that primary backend. Existing VM environments retain their private catalogs and ports; when viewing them after the DNS cutover, bind `127.0.0.2:<assigned HTTPS port>` to the same port on `devresults-vm`.

New mini allocations use 30000–39999 and are committed under the authoritative registry lock. The allocator also checks Windows listeners, HTTP.sys and existing claims. Primary ports and documented e2e lane ports remain excluded even while their services are stopped. Existing VM allocations remain unchanged.

## Requests, privileges and recovery

The CLI submits an immutable request and waits for its atomic result. Disconnecting SSH does not cancel the request. Repeat an identical command to attach while it is active, or inspect the printed UUID:

```sh
drenv --host mini request <request UUID>
```

Receipts live under `registry\requests\<UUID>`. One expensive lifecycle request runs at a time; read-only requests and independent servers can run concurrently. An interrupted controller worker is reported as interrupted rather than replayed automatically. Use `status`, inspect the specific task/receipt, then `recover <id>` when abandonment is proved. Do not edit receipts, delete uncertain locks, or kill shared processes. Controller errors and logs are at `C:\DevResultsEnvironments\controller.log`.

The controller and legacy IIS/maintenance tasks perform privileged Windows operations. Installs, legacy frontend watch and VibeResults dev servers use limited S4U tasks. All scheduled entry points use machine-wide PowerShell 7. Framework-only schema and maintenance code runs in Windows PowerShell 5 with a corrected module path. JavaScript commands explicitly use Node 24 through mise; they do not depend on a global Node default. This avoids elevated SSH's inability to traverse limited-user pnpm junctions and keeps processes alive after SSH exits.

Build-only changes to the OpenAPI generator label or line endings are restored to their exact pre-build bytes. Any contract change remains visible and fails the source-cleanliness gate. Builds otherwise require committed source and continue to verify the real schema fingerprint before a runtime can start.

## Initial snapshot and live evidence

The first snapshot is a relocated copy of the coordinated September 16 dev/example capture documented in [installation evidence](INSTALLATION-EVIDENCE.md#september-16-coordinated-source-snapshot). Relocation retains capture provenance and verifies original SQL/blob bytes; it does not take a new live primary snapshot or substitute e2e data. Each environment restores private data and reconciles its own schema. The historical missing-attachment limitation of that source capture remains.

See installation evidence for the completed mini proof and its remaining limitations. A component build, running Vite listener, registry entry or printed URL alone is not proof of a complete useful-data stack.

On October 21, two native stacks ran concurrently and both VibeResults dashboards rendered 45 projects and populated charts through their own backends. Source, SQL and blob isolation, native client-watch publication, independent stop/restart, actual dependency installation after requester exit, and owned removal were verified. Alpha remains running on IIS HTTPS 30000 and VibeResults HTTPS 30006, with its client watcher. Beta was removed after the proof.

The native video-feedback helper reused alpha successfully. Mac viewing and desktop placement were unavailable while the Mac slept. A disposable legacy browser session reached the application's privacy-policy gate; no policy was accepted. The primary Vibe server on 9443 had already crashed before this continuation and was left stopped under the protected-resource constraint. See [the dated evidence](INSTALLATION-EVIDENCE.md#october-21-native-mini-verification) for receipts and the final comparison.
