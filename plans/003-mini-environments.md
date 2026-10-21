# Isolated environments on the mini

## Goal

Let several agents work directly on the mini in separate DevResults environments, each optionally paired with a VibeResults worktree and dev server, with the same environments controllable from the Mac.

## Confirmed scope

Herb confirmed native mini operation and Mac control on 2026-10-21. Agents' edits, installs, builds and servers must continue independently of the Mac and its SSH connection. Keep the existing VM environment workflow usable. Implementation waits for Herb's approval of this plan; create Beads tasks only after approval.

## Findings

`drenv` already records the Windows host in each manifest, but registry defaults, source transport and asset transport enforce `devresults-vm`. Its registry and source lifecycle also assume a Mac worktree. Windows provisioning and builds use primary-checkout paths that differ from the mini's `C:\Code\DevResults\devresults` layout. The supervisor already uses scheduled tasks and Windows Jobs, but launches tasks elevated and assumes tool commands resolve from PATH.

The mini has no `C:\DevResultsEnvironments`. Read-only inspection found about 881 GB free on C:, the existing `VibeResults dev` task running with S4U and limited privileges, and the `mini-targeted` e2e lane listening on 20615 and 20617–20619. Recheck capacity and all reserved resources during implementation; this observation is not a capacity reservation.

VibeResults already reads `DEVRESULTS_ORIGIN` and `APP_HTTPS_PORT`, binds loopback with `strictPort`, and serves its existing certificates from `.cert`. No application proxy change appears necessary. Its current video-feedback helper assumes the VM environment `design-refresh`, a Mac worktree, port 9446, Unix process management and macOS desktop automation.

The verified September 16 dev/example snapshot is documented in `scripts/devresults-environments/INSTALLATION-EVIDENCE.md`. Its Mac receipt and both VM artifact paths still exist. Their hashes and SQL validity have not been rechecked in this planning pass. Existing evidence records a historical attachment-data limitation; copying this snapshot cannot repair missing source attachments.

## Approach

### Host selection and one owner for state

Add an explicit host selector, proposed as `drenv --host mini <command>`, and a matching environment default. Persist the chosen host at creation and reject attempts to retarget an existing environment. Validate SSH aliases before transport. Replace hard-coded primary paths with a host profile containing source/config templates, environment root, tool resolution and port policy.

For mini environments, keep the authoritative registry, creation intents, operation receipts and locks on the mini under `C:\DevResultsEnvironments`. Native agents invoke the local CLI; the Mac forwards structured requests to that same CLI over SSH. Neither entry point maintains a second writable registry. A dropped SSH connection leaves the operation running and queryable by its request identity; retrying must attach to that operation rather than start another restore or install. Retain the current Mac registry and paired-source workflow for existing VM environments, without adopting or rewriting their resources.

Native mini environments have one editable Windows DevResults worktree and a separate deployment, SQL catalog, blobs, cache, temp and mail pickup paths. They do not require a dummy Mac worktree or an SSH round trip to themselves. Use committed revisions for legacy deployments and preserve dirty source worktrees during lifecycle operations. Adapt source/status/cleanup validation to distinguish native Windows environments from existing paired environments. Mac-controlled creation names native mini source paths explicitly; existing Mac-to-VM source transfer remains available.

### Privileges and process lifetime

Use a one-time mini bootstrap to install the CLI entry point and host control resources. Keep privileged SQL, HTTP.sys, TLS and task registration operations behind an explicit elevated control path. Confirm that agents running without elevation can invoke the registered control entry point, rather than requiring every T3 agent to run elevated.

Run dependency installs and JavaScript dev/watch servers in limited S4U scheduled tasks under Herb's account. Use the machine-wide PowerShell 7 executable and `mise exec node@24 --` with explicit tool paths. Never run installs through elevated SSH or reuse the main checkout's `node_modules`. Check install exit codes before launching a server. Preserve and extend the existing ownership receipts, exact task/action checks and process containment; stopping an environment must stop only its verified children. Audit legacy build/client-watch and shared Azurite installation paths for the same junction and PATH problems, including assumptions tied to Windows PowerShell 5 APIs.

Keep host-wide locking for short resource claims and operations that require serialization. Run independent environment servers concurrently. Bound expensive build/restore concurrency for the mini's 32 GB RAM and expose queued/running/failed operation status and logs. Recovery must use owned receipts and task/process identity, never broad process kills or manual lock deletion.

### Optional VibeResults side

Proposed creation inputs are `--vibe-source <native mini checkout>` and optional `--vibe-revision <ref>`, resolving the revision once, with `HEAD` as the default. Record the VibeResults source, worktree, frozen initial revision, current revision and HTTPS port alongside the legacy resources. Legacy-only creation stays available. Create an editable worktree with its own dependency installation; the shared pnpm content store is acceptable, but the worktree must have its own `node_modules` and writable build caches.

Copy `.cert/` and `.env.local` from the explicitly selected main VibeResults checkout into the new worktree, preserving private access and keeping them out of Git and logs. Prefer copies to cross-privilege junctions. Refuse missing prerequisites before installing. Set `DEVRESULTS_ORIGIN=https://<instance>.devlocal.us:<owned IIS port>`, `APP_HTTPS_PORT=<owned VibeResults port>` and browser suppression in the task's process environment, overriding copied defaults. Preserve the tenant host used by the existing proxy and verify its API requests reach the owned catalog.

Extend start, stop, status, URL output, recovery and removal to cover both sides. Start legacy first, then VibeResults; report partial failure accurately. Starting an already-running healthy environment reuses it. Status reports each side's task/process health, paths, revisions, ports and log locations. Ordinary start or video preparation must not move a worktree to another revision or reinstall dependencies. Legacy sync/reset stops dependent VibeResults traffic while changing the backend and leaves an explicit stopped/provisioned result; the normal start command brings both sides back. Source and dependency changes remain explicit, with dirty worktrees preserved.

### Ports and Mac access

Allocate new mini environment ports dynamically from a host-specific range, proposed as 30000–39999, with claims checked under a host lock against listeners, HTTP.sys and other environment claims. Reserve the VibeResults port as part of the same transaction. Explicitly exclude the primary ports and all documented e2e lane ports even when those services are stopped. Retain existing VM allocations.

Return both application URLs and exact SSH tunnel commands. VibeResults uses `ssh -N -L <vibe port>:127.0.0.1:<vibe port> mini`, then `https://example.viberesults.dev:<vibe port>`. Viewing legacy alongside it also forwards its IIS HTTPS port unchanged, because redirects can contain that port. Verify local port availability and DNS/TLS before opening pages. Keep tunnel ownership separate from remote runtime ownership, so closing a tunnel never stops the environment.

### Initial data and protected resources

Copy the existing immutable dev/example SQL/blob snapshot from the VM through the Mac to a new mini snapshot directory. Verify hashes at each boundary, verify the SQL backup, and write a relocated receipt retaining its capture provenance. Keep the original artifacts and receipt intact. Each environment restores a private catalog and blob copy and passes the existing schema reconciliation gate. Do not substitute the e2e backup or take a fresh primary snapshot silently.

Do not change or restart the main DevResults site on 443, the main VibeResults task on 9443, any e2e lane, or the migration work in `C:\Users\herb\setup\mini-migration.md`. Record their relevant task/process identities, bindings and source/database identities before and after the live proof. Do not modify existing checkout configuration to make a new environment work.

## Tasks

1. **Add configurable Windows hosts and native mini control.** Introduce host profiles, validated host selection, native Windows source/registry handling, durable remote requests and the bootstrap/control privilege boundary. Parameterize VM-only transports and template/tool paths. Verify native and Mac callers share one mini registry and that existing VM manifests and commands still validate. Use focused behavioral tests for routing, ownership, retries and concurrent reservation, plus Windows checks for the task privilege split and disconnected operation.
2. **Add the optional VibeResults lifecycle.** Extend manifests and atomic port claims, create owned worktrees and copied local assets, install dependencies non-elevated, and supervise Vite against the owned IIS origin. Integrate both sides with lifecycle/status/recovery/removal and native frontend iteration. Verify install failures, foreign listeners, dirty source, partial startup, restart/retry and source ownership. Keep executable changes in dotfiles unless inspection demonstrates an application change is required.
3. **Bootstrap and prove two environments on the mini.** Transfer and verify the immutable snapshot; create two default dev/example environments with VibeResults enabled. Prove distinct source paths, dependency trees, catalogs, blobs, IIS/Vite ports and tasks. Verify each frontend's API reaches its own backend, demonstrate an isolated edit or data change, disconnect SSH, and confirm both remain healthy. Stop/restart one and show the other remains healthy. Exercise owned cleanup on a disposable proof environment and show that the surviving environment and protected resources remain intact. Record real application/browser evidence and any inherited data limitations.
4. **Update agent and video-feedback workflows.** Update `drenv` usage/lifecycle/install evidence and the shared `mini` and `devresults` skills with native mini operation, host selection, privilege rules, worktree discovery and tunnels. Update VibeResults' `prepare-for-video-feedback` skill and helper to accept an explicit host/environment and consume its two URLs, reusing healthy runtimes and preserving current revisions. Keep macOS desktop placement as a separate Mac-only final step. Preserve the existing VM/Mac recording path. Verify environment selection and refusal behavior with focused helper tests and run the mini-backed preparation without touching shared runtimes.

Each checkpoint gets a coherent commit and relevant verification. Commit dotfiles to main and push; commit the VibeResults helper/skill change in its repository following its instructions. Create the epic and checkpoint issues after plan approval, with the VibeResults lifecycle depending on native control, the live proof depending on both, and final workflow verification depending on the proof.

## Acceptance

Two agents can edit separate mini worktrees while two complete stacks run concurrently. Mac and native commands observe the same environment state. Both frontends serve HTTPS and proxy to their own useful-data backend. Installs and runtime tasks work without elevated junction traversal and survive SSH disconnects. Stopping or removing one environment preserves the other and all protected resources. VM environments remain usable. The updated skills describe only behavior demonstrated by the implementation and distinguish helper tests from live application proof.

## Unresolved questions

No further product decision is needed beyond approval of this approach. Implementation must verify snapshot integrity, TLS/DNS, native agent access to the elevated control entry point, and the Windows PowerShell/API dependencies before choosing exact task boundaries. If the retained snapshot fails validation, stop that provisioning path and report the concrete prerequisite; do not pause or copy live primary data without a separate decision.
