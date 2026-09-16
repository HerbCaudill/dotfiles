# Personal DevResults environments

`drenv` creates paired Mac and Windows source worktrees with their own SQL data, Azurite state, deployment, IIS ports and process supervisor. Run it on the Mac. Home Manager installs it from this dotfiles repository; Windows operations travel through `devresults-vm` SSH.

## Install and check

Apply the dotfiles configuration with `pnpm nix:rebuild`, then run:

```sh
drenv --help
drenv status
```

The command uses the Node installation already managed by the Mac environment. Windows builds use the existing DevResults build tools and recipes, including the native spatial-library recipe on ARM64. The runner installs its own pinned Azurite dependency when needed. [Lifecycle details](LIFECYCLE.md) describe supervision, builds and schema verification.

## Create an environment

A full environment needs a coordinated SQL/blob snapshot and enough free Windows disk space. See the prerequisites below before creating large source copies.

```sh
drenv create example-change \
  --source ~/Code/DevResults/DevResults \
  --revision HEAD \
  --snapshot /absolute/path/to/coordinated-snapshot.json

drenv start example-change
drenv open example-change
```

Use the canonical native checkout path; symlink aliases such as macOS `/var` are refused. Creation freezes the selected Git revision and creates native source worktrees on both hosts. It then checks capacity, builds, restores owned data, generates runtime configuration, and independently compares the built schema with the restored database. `start` launches the complete IIS/Azurite runtime and verifies its owned endpoints. It creates an owned HTTPS firewall rule restricted to the Mac IP seen by SSH; a changed peer or modified rule is refused for inspection. Complete removal cleans up that verified rule. `open` uses your normal Chrome profile; cookies remain shared with your existing development browsing.

The default data source is `dev` / `example`. For INL work:

```sh
drenv create inl-change \
  --preset inl \
  --source ~/Code/DevResults/DevResults \
  --revision HEAD \
  --snapshot /absolute/path/to/coordinated-inl-snapshot.json
```

The INL preset selects `dev-inl` / `inl`. `--database <catalog>` and `--instance <name>` support an explicit source selection. The receipt must describe that source. Each environment gets a separate owned catalog; source catalogs are never shared as writable environment data. A receipt's capture revision may differ from the selected source revision, but the actual built schema must match before startup.

Creation saves its inputs and checkpoints. If a snapshot was omitted, source pairing can finish before creation reports the missing receipt. Resume with `drenv create <id> --snapshot <receipt.json>` after satisfying the prerequisite. Repeating `create <id>` uses the saved selections. An existing selection cannot silently change.

## Edit, sync and run

The mapped source and runtime paths are:

| Resource                      | Location                                 |
| ----------------------------- | ---------------------------------------- |
| Mac source                    | `~/Code/DevResults/environments/<id>`    |
| Windows source                | `C:\DevResultsEnvironments\source\<id>`  |
| Windows runtime               | `C:\DevResultsEnvironments\runtime\<id>` |
| Mac registry and saved inputs | `~/.local/state/drenv`                   |

Edit and commit in the mapped Mac worktree, then run:

```sh
drenv sync example-change
drenv start example-change
drenv open example-change
```

`sync` stops that environment, sends committed source to its mapped Windows worktree, rebuilds and checks the schema. It leaves the environment stopped. Use `drenv sync <id>` for these paired worktrees; the existing `dr` and `drsync` commands retain their primary-checkout workflow.

`drenv status` lists persisted state. `drenv status <id>` also inspects the Windows supervisor. `drenv url <id>` prints the reserved URL. Ports are allocated dynamically from actual host inventory; no manual lane configuration or separate Chrome profile is required. A printed URL is not a health check.

## Stop, save data and clean up

```sh
drenv stop example-change
drenv snapshot example-change
drenv reset example-change
drenv remove example-change
```

Use each command when needed; this block is a command reference, not a sequence to run automatically. `snapshot` stops the owned runtime and captures its SQL and blob data together. It returns a receipt path and leaves the runtime stopped. To create another environment from that snapshot, use the snapshot's owned catalog as `--database` and retain its instance selection.

`reset` discards the environment's current data and restores its original creation snapshot. `remove` deletes the verified owned runtime, data and clean source worktrees. These commands refuse foreign ownership, external SQL writers and uncommitted source changes. Removal retains a registry tombstone so a later command cannot accidentally adopt leftover resources under the same ID; choose a new ID for a new environment.

After an interrupted command, inspect `drenv status <id>` and use `drenv recover <id>` when the recorded operation has ended. Then retry the original command. Recovery verifies Windows state before releasing abandoned Mac locks. It refuses a live or ambiguous operation. Never delete lock files or edit ownership receipts to bypass a refusal.

## Live prerequisites

Initial creation requires an immutable SQL backup and Azurite directory captured during one coordinated pause of every source writer. The public `snapshot` command handles owned environments; it does not adopt or stop primary/review environments to create the first snapshot. Coordinate the initial capture explicitly with whoever is using those source runtimes. The backup must be checksummed, and the receipt must include its source identity, schema hash, full SQL file allocation, both artifact hashes and evidence of the shared pause. [The provisioning contract](PROVISIONING.md) defines the receipt.

Disk must cover full SQL allocation, the deployment copy, blob state and 2 GiB provisioning headroom. Source worktrees, dependency installation and build output also consume space. Refresh requires space for the app copy plus 512 MiB. These checks do not substitute compact fixtures or delete existing databases to fit the available C: space.

The oversized recovery partition was repaired on September 16. C: now occupies approximately 1,021 GiB of the existing 1 TiB virtual disk, with a separate 2 GiB WinRE partition. Windows reported approximately 225 GiB available after the repair; usable space also depends on the Mac's physical free storage. [The repair evidence](INSTALLATION-EVIDENCE.md#september-16-partition-repair) records the exact sizes and verification. Remeasure capacity before provisioning. A coordinated default dev/example source snapshot was subsequently captured and verified; see [the capture evidence](INSTALLATION-EVIDENCE.md#september-16-coordinated-source-snapshot) for its receipt.

Windows needs elevated SSH for owned HTTP.sys bindings, the current local `devlocal.us` certificate, SQL backup/restore permissions, the existing .NET/Node/pnpm/just build tools, and permission to run the passwordless S4U scheduled-task supervisor. The runner reads only the existing `MSBUILD` and `VSTEST` path settings from the primary build configuration. It generates runtime settings in an owned deployment copy and keeps automatic schema refresh disabled.

## Verification status

See [the installation evidence](INSTALLATION-EVIDENCE.md) for actual command results, live capacity and the remaining acceptance checks. Helper suites and disposable source fixtures verify particular behaviors; they do not prove a complete useful-data environment. The September 16 live proof created and started three environments, verified two populated dashboards in normal Chrome, demonstrated source/data/process isolation, and preserved the recorded original-resource baseline. The copied primary local blob store lacks legacy example attachments; see the evidence for that inherited limitation and the exact browser coverage.
