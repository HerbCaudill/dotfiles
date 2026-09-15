# Personal DevResults environments

## Goal

Provide a Mac-initiated command that creates and manages any number of paired Mac/Windows DevResults worktrees with independent runtimes and data, entirely through Herb’s personal dotfiles tooling.

## Authoritative decisions

- All machinery belongs in this dotfiles repository: TypeScript Mac orchestration, versioned PowerShell payloads invoked through SSH, command installation, documentation, and personal skill guidance. Do not edit the DevResults repository’s tracked scripts, recipes, instructions, package metadata, or product code. Its existing build commands can be invoked unchanged. Treat e2e and existing worktree scripts as read-only references rather than runtime dependencies to modify.
- Creation always starts on the Mac and normally creates paired native Mac and Windows worktrees. Never access the Windows checkout through its macOS mount. Use `devresults-vm` SSH for source, configuration, builds, IIS, and SQL work.
- Default source database/instance: `dev` / `example`. INL-specific work selects `dev-inl` / `inl`. Copy these into owned catalogs; never use them as shared writable environment databases. Support explicit revision and data-source selection.
- Use Herb’s normal Chrome profile and existing cookie behavior. Shared-cookie tradeoffs are accepted. Do not add cookie isolation, separate interactive profiles, or hostname changes as a prerequisite. Automated role tests may use isolated contexts.
- Disk can be expanded. Check actual capacity and report a concrete host prerequisite if creation cannot proceed; do not substitute compact fixtures for useful cloned data merely to avoid expansion. Do not delete existing databases or work to free space.
- Each environment has a stable ID, own source/build output, SQL catalog/files, IIS configuration/ports, Azurite endpoints/state, caches/temp/mail/output directories, manifest, and process ownership. Allocate dynamically with host-wide coordination; do not hard-code seven lanes.
- Keep existing primary, e2e, Vibe, and report environments untouched. Existing allocations include 443/8080, 444, 44400/8100, macOS 8443/8444/9443–9445, and Azurite 10000–10002/10010–10012. Discover real ownership before any mutation.
- A new personal command such as `drenv` can coexist with existing `dr`/`drsync`; do not redirect their default destination. New paired environments must sync explicitly by environment identity. Keep one complete personal start command, with no ad hoc required terminals. A personal runner package may expose `pnpm dev`; do not add that script to DevResults to satisfy startup conventions.
- No Google Tasks changes or messages to others. Git commits/pushes for implementation and Beads publication are part of the authorized orchestration workflow.

## Evidence

September 15 read-only investigation is recorded in Obsidian `documents/projects/INL custom work.md` and `DevResults isolated development environments.md`. Their earlier proposals to extend the DevResults scripts and isolate Chrome profiles are superseded by the decisions above.

`scripts/devresults-sync/constants.ts` currently hard-codes `C:\Code\DevResults`. Windows `scripts/worktree/` already creates source, copies settings, and provisions optional IIS bindings but does not copy databases or isolate all external state. `RunIISExpress.bat` starts IIS alone and selects config paths differently from some helpers. e2e has proven catalog guards, explicit Azurite configuration, state overrides, runtime identity, leases, and supervised Windows mutation recovery worth studying.

The Windows VM was observed with approximately 6.9 GiB free, 12 GiB RAM, and `dev-inl` allocated at 40.6 GiB. Recheck before provisioning. Restore data with coordinated SQL/blob snapshots and schema compatibility; never silently upgrade the source catalog.

## Tasks

1. **Environment identity, CLI, and registry.** Define the personal command surface, stable manifest, source/data presets, dynamic allocation, locking, ownership, resumable lifecycle, and safe execution interfaces. Document the internal contracts before dependent tasks start. Test concurrent allocation, invalid IDs, ambiguous mappings, and foreign-resource refusal.
2. **Paired source and revision sync.** Create/register native Mac and Windows worktrees via Git/SSH, select frozen revisions, and sync only the mapped destination. Preserve dirty source, primary checkouts, and foreign ownership. No mounts or implicit WIP changes to the wrong destination. Test pairing, revision transport, dirty-destination refusal, and retry recovery.
3. **Windows isolated data and runtime provisioning.** Personal PowerShell scripts create unique SQL/blob/config/IIS/storage resources, restore compatible snapshots, provision only owned ports, and record ownership. Reuse concepts without editing DevResults or e2e. Verify configuration and implement refusal/recovery tests, including SQL/blob consistency and interrupted creation. Source runtime snapshotting must not stop or mutate a live foreign environment without explicit coordination.
4. **Complete lifecycle and recovery.** Integrate create/start/status/url/open/stop/snapshot/reset/remove through the personal command. Manage complete process trees, environment build freshness, normal Chrome, and owned state restoration. No global process killing or destructive cleanup of unknown resources. Test interrupted commands and cross-environment survival.
5. **Install, document, and prove the workflow.** Install through Home Manager, update the personal DevResults skill and dotfiles documentation, and demonstrate creation of two environments from the public Mac command with independent source/data/processes; create a third without manual configuration to prove repeatability. Verify original environments unchanged. If VM expansion or elevation is required, prepare and report the exact prerequisite; do not call unperformed live verification passed. Exercise focused INL preset selection without requiring all seven review environments or conducting their human showcases.

## Orchestration

One epic with five review-sized child tasks. Task 1 blocks tasks 2 and 3, which may proceed in parallel only with non-overlapping ownership of source modules. Tasks 2 and 3 block task 4; task 4 blocks task 5. Implementers leave issues open for independent review and report base SHA, ordered commits, checks, and pushed branch. Only the coordinator closes independently approved work. Do not clear unrelated Beads work.

Use the saved dotfiles checkout and coordinate commits; preserve pre-existing changes to `home/.claude/skills/grill-me/SKILL.md` and `.DS_Store` files. Do not use worktrees for the implementation workers unless Herb authorizes that separately. Worktrees produced by the environment tool are the requested feature and are authorized.

## Verification and skills

Follow `code-style`, `devresults`, `manage-tasks`, and `orchestrate`; independent reviewers use `do-code-review`. Read applicable repository instructions. Use focused red-green behavioral tests for new executable behavior, owning-tool validation for config, and real Windows integration for runtime claims. Publish reviewed implementation commits and Beads state. Keep credentials out of tracked files and logs.

## Unresolved questions

No product decisions block implementation. Runtime inspection may expose capacity, SQL backup permissions, elevation, or local configuration prerequisites; diagnose those concretely and continue independent implementation work while resolving them.
