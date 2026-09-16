# Windows provisioning contract

`provisionWindowsEnvironment(manifest, { snapshot, operation? })` accepts the local path of an explicit coordinated snapshot receipt. `operation: "verify"` checks prerequisites and returns `status: "verified"`; the default operation creates owned data/configuration and returns `status: "provisioned"`. Neither status proves that the built application schema is compatible or that an application has run. The caller owns the Mac environment lock and registry checkpoints. Windows operations serialize using an exclusive host file handle, which cannot be stolen while its process remains alive.

`refreshWindowsDeployment(manifest)` replaces the owned deployment after a completed Windows build and returns `status: "refreshed"`. Stop the verified owned runtime before calling it. It refuses live reserved listeners or processes whose command lines reference this environment's source/runtime. It checks source ownership, Git store, current revision, native paths, reparse points, and disk space. This is also the freshness boundary after source sync. The caller must independently prove the completed build belongs to that revision.

## Data and runtime layout

All state lives below the reserved Windows runtime directory. `owner.json` carries the stable ID/token; the personal host root contains `claims/<id>.json` with owned SQL catalog, runtime path and five ports. SQL files live under `sql/`, the copied Azurite state under `blobs/`, and IIS configuration under `iis/applicationhost.config`. `cache/`, `temp/`, `mail/` and `output/` are independent directories. The actual IIS site physical path is `runtime/web`.

`web/` is an owned deployment copy of the paired worktree's `DevResults` application directory. It contains copied build output, so build before refreshing. Every refresh creates a complete copy rather than retaining obsolete application files. Its `.drenv-deployment.json` records ID/token/revision and `copying` or `ready`. Capacity checks and copying share one traversal that excludes build-only `node_modules`, `.git`, source `.azurite` state and deployment markers at every depth. Excluded directories are never traversed, so ordinary pnpm junctions stay outside the deployment. Every included source path and the existing deployment still reject symlinks/junctions, and unmarked existing deployment directories are refused. It writes generated configuration only into this deployment; tracked DevResults files and ignored configuration in the source worktree stay unchanged.

Generated `web/Core/Db/connections.config` uses integrated SQL authentication to the owned catalog and explicit loopback blob/queue/table ports. Generated `web/SecureSettings.config` copies the private primary settings template, preserves the blob container, redirects temp/cache, clears `AzureBlobStorageAccount` so the app cannot bypass the local connection string for cloud credentials, and sets `AutoDbRefresh.Enabled=false`. Generated `web/Web.config` directs pickup mail to owned `mail/`. These files can contain local private configuration and must never be logged or committed.

`azurite-secret.json` contains a generated account key for the `devstoreaccount1` account already present in copied Azurite data. The lifecycle runner must set `AZURITE_ACCOUNTS` from this private file and start Azurite with `--location <runtime>\blobs` and the three reserved ports. It must not expose the key in logs, process arguments or registry state. IIS must start with the explicit owned `/config:<runtime>\iis\applicationhost.config` and `/site:DevResults` arguments. HTTPS owns an HTTP.sys binding whose AppId is the environment's UUID token; no foreign bindings are replaced.

## Snapshot receipt

Creation never snapshots, pauses or stops a foreign runtime. Supply an immutable native Windows SQL backup and Azurite directory captured during one externally coordinated writer pause. A receipt is an operator or owned-runtime attestation; it does not itself pause writers or compute application schema compatibility. Its revision records capture provenance and may differ from the current frozen build. Lifecycle startup independently compares the current built provider with restored SQL; reset can therefore reuse an older immutable snapshot when the schema is still compatible. The SQL backup must contain one full checksummed backup of the selected source catalog. An illustrative receipt follows (replace every placeholder with measured evidence):

```json
{
  "version": 1,
  "sourceDatabase": "dev",
  "sourceInstance": "example",
  "revision": "<40-character frozen Git SHA>",
  "schemaHash": "<actual dbo._Global SchemaHash>",
  "coordination": {
    "method": "writers-paused",
    "startedAt": "2026-09-15T08:00:00Z",
    "completedAt": "2026-09-15T08:01:00Z",
    "evidence": "<who coordinated all SQL/blob writers and how both captures were verified>"
  },
  "sql": {
    "path": "C:\\Snapshots\\one\\database.bak",
    "sha256": "<SHA256 of backup bytes>",
    "allocatedBytes": 6000000000
  },
  "blobs": {
    "path": "C:\\Snapshots\\one\\blobs",
    "sha256": "<directory digest>",
    "bytes": 12000000
  }
}
```

The directory digest is SHA256 over UTF-8 lines sorted by PowerShell `Sort-Object` on each relative native path. Each line contains the relative path with `/` separators, a tab, decimal file byte length, a tab, lowercase SHA256 of file bytes, and LF. Hidden files are included; empty directories have no lines. Reparse points and tab/newline filenames are refused. The versioned `Get-BlobDigest` helper is authoritative for snapshot producers. SQL allocation is the sum of `RESTORE FILELISTONLY` file sizes. Full SQL/blob hashes are checked before restoration and the copied blob digest is checked again afterward.

Before startup, the lifecycle runner independently computes the built application's actual registered `IVersionStateProvider.Compute()` result in its hosted context and compares it with the restored `dbo._Global` SchemaHash. A receipt's revision/schema fields are not this computed evidence. Keep auto-refresh disabled until that check succeeds; never silently upgrade the source or owned catalog to bypass incompatibility.

## Refusal and recovery

Preflight inventories listeners, personal claims and HTTP.sys reservations under the Windows host lock. It requires a native paired source marker, matching Git store/revision, sufficient free bytes for SQL allocation plus the complete app copy and blob data plus 2 GiB headroom, elevated SSH, and a current local devlocal.us certificate with its private key. SQL Server receives access only to the owned SQL directory. Refresh separately requires app-copy bytes plus 512 MiB free.

`provision-journal.json` records ownership, snapshot identity, source revision, the restoring process PID and start time, and `restoring` or `data-ready`. SQL catalogs also carry ID/token extended properties and must refer only to owned `sql/` files. A retry must use the same SQL/blob snapshot. A failure after SQL restore but before ownership properties are recorded is deliberately refused: inspect the journal, verify that exact Windows process and SQL restore have ended, and explicitly recover the exact owned catalog/files. If a failed restore leaves SQL files without a catalog, retry refuses before replacing the original journal; its snapshot identity, PID and timing evidence remain intact for recovery. A missing marker never permits adoption. Partial blob copies fail digest validation; do not silently accept them. A partial owned web copy is safely replaced only after no runtime/build is using it. A local SSH timeout alone is not evidence that Windows mutation has stopped.

The lifecycle runner owns explicit reset/remove and complete process supervision. It must use these receipts plus actual process identity, catalog/file identity and binding AppId; a token alone is not permission to kill a reused PID or remove an arbitrary path.

## Verification evidence

Run Mac behavioral checks with `pnpm exec vitest run scripts/devresults-environments/tests/provisioning.test.ts`. Run the versioned helper suite on Windows with `node scripts/devresults-environments/runWindowsProvisionTests.ts`. The latter creates and removes only an isolated Windows temporary directory and mocks listener/HTTP.sys inventory. It exercises real PowerShell XML generation, blob hashing, ownership refusal, interrupted-catalog refusal, SQL file path checks and atomic journal replacement. It does not create a SQL catalog, change a live HTTP.sys binding or start an application.

On September 15 the helper checks passed. Live useful-data provisioning remains unperformed. A coordinated default dev/example SQL/blob snapshot was captured and verified on September 16. The initial capacity blocker was repaired on September 16 by extending C: and recreating a 2 GiB WinRE partition. Windows then reported approximately 225 GiB available; remeasure before provisioning and account for the Mac's physical storage. See [the repair evidence](INSTALLATION-EVIDENCE.md#september-16-partition-repair). See the installation evidence for the coordinated capture receipt. Elevated SSH and the default `MSSQLSERVER` service were observed; this does not imply a restore/runtime integration pass. The partition repair did not perform source capture or application acceptance checks.
