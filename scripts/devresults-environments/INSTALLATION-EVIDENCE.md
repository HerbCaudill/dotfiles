# Installation and public-command evidence

Installation was verified on September 15, 2026. After the September 16 partition repair and coordinated snapshot, the installed public command created and started three independent DevResults environments. Two passed populated-dashboard checks in the normal Chrome profile; the third passed startup and Mac HTTPS checks. Source, SQL, blob and process isolation checks passed. The pre-existing attachment-data limitation is recorded below; existing attachment downloads were not demonstrated.

## Installation

- Nix parsed `nix/home/files.nix` and evaluated the `home.file.".local/bin/drenv".source` mapping successfully.
- `pnpm nix:rebuild` completed in an interactive PTY and activated Home Manager.
- `command -v drenv` resolves to `/Users/herbcaudill/.local/bin/drenv`, through Home Manager's out-of-store link to the executable `scripts/devresults-environments/drenv.ts`.
- `drenv --help` succeeded from the normal shell. The initial `drenv status` returned an empty registry.

## Bounded public-command proof

A tiny disposable Git repository containing only a README was used to avoid copying full DevResults source while the snapshot prerequisite was unresolved. These were installation checks, not application environments.

The first attempt, `drenv create install-proof-inl-20260915 --preset inl --source <temporary-source>`, refused macOS's `/var` symlink before creating any paired source. That refusal was correct; the canonical path is under `/private/var`. Cleanup exposed a separate bug: removal assumed every reservation already had a verified revision. The fix now permits removal without a revision only after proving the Mac source/marker and Windows source/store/runtime/claim/catalog/task/process/ports are absent. Partial pairing evidence is preserved and refused. No registry files were manually erased or edited.

A second attempt used the canonical source path and a new ID:

```sh
drenv create install-proof-inl-canonical --preset inl --source <canonical-temporary-source>
drenv status install-proof-inl-canonical
drenv url install-proof-inl-canonical
```

The command paired native Mac/Windows source at the same frozen commit, then returned `Supply --snapshot with a coordinated SQL/blob receipt to resume this creation`. Status recorded `dev-inl` / `inl`, the `source-paired` checkpoint, and a stopped supervisor with no runtime receipt. The printed URL was `https://inl.devlocal.us:20006`. No database restore, application build, application start or browser health check ran.

Both IDs were removed with the installed public command. Direct checks confirmed that their Mac source/markers and Windows source/stores/runtime directories/host claims were absent, and SQL contained neither fixture catalog. The temporary source repository was then removed. The registry retains two `removed` tombstones as designed; these are test history, not usable environments.

## Existing environment observations

Read-only inventories bracketed the public fixture work at 17:01 and 17:08 UTC:

- `dev` and `dev-inl` retained their names, `ONLINE` state, read-write flags and allocated file sizes.
- HTTP.sys SSL binding and URL reservation fingerprints matched.
- The primary checkout remained at `4dfa564ce5128c261bf70a33cb5f90f8becdc50b` and the report checkout at `e60c1bb4cafe08ce88574cf357e1450c28be0c69`. Both remained clean. Their tracked Web.config and local IIS configuration fingerprints matched.
- No `iisexpress.exe` processes or established primary/report/Azurite listeners were present at either inventory. Their absence was independently confirmed before the fixture commands. This run did not stop those applications and does not establish why they were absent. It does not prove survival of running primary/review environments.
- C: free space changed from 4,604,305,408 to 4,406,026,240 bytes during the interval. The cause of that change was not established. Do not infer source data loss or attribute the change to the fixture solely from these observations.

## September 15 capacity evidence

A final read-only sizing check measured C: free space at **4,405,739,520 bytes (4.10 GiB)**. Source SQL allocation was **6,054,281,216 bytes (5.64 GiB)** for `dev` and **43,570,429,952 bytes (40.58 GiB)** for `dev-inl`. The deployable application copy measured **567,846,866 bytes** after excluding build-only dependencies. Existing source Azurite files totaled **12,339,468 bytes**; measuring live files is not a coordinated snapshot.

| Selection                 | Measured SQL + app + blob + 2 GiB provisioning headroom | Shortfall against that C: reading |
| ------------------------- | ------------------------------------------------------- | --------------------------------- |
| Default `dev` / `example` | 8,781,951,198 bytes (8.18 GiB)                          | 4.08 GiB                          |
| INL `dev-inl` / `inl`     | 46,298,099,934 bytes (43.12 GiB)                        | 39.02 GiB                         |

These are lower bounds for one environment. Additional native source copies, package dependencies, build output outside the deployment, and any snapshot artifacts stored on C: need their own space. Three default useful-data environments would require at least approximately 20.54 GiB free for their SQL/app/blob copies and shared remaining 2 GiB headroom, before those additional costs. These shortfalls describe the September 15 reading, before the repair below. Remeasure available space before creating environments. Existing data must not be deleted merely to make room.

### Partition layout findings

A subsequent read-only inspection showed that the Parallels virtual disk is already **1,099,511,627,776 bytes (1 TiB)**. Windows Disk 0 has the following layout:

| Resource                                                 | Exact size            | Approximate size |
| -------------------------------------------------------- | --------------------- | ---------------- |
| Partition 4, C:                                          | 273,326,014,464 bytes | 254.55 GiB       |
| Partition 5, active WinRE recovery, immediately after C: | 825,421,184,512 bytes | 768.73 GiB       |
| Recovery volume size reported by `Get-Volume`            | 825,421,180,928 bytes | 768.73 GiB       |
| Free space inside the recovery volume                    | 824,600,018,944 bytes | 767.97 GiB       |
| Used space inside the recovery volume                    | 821,161,984 bytes     | 0.765 GiB        |

The used-volume figure is the `Get-Volume` size minus its free space: 825,421,180,928 − 824,600,018,944 = 821,161,984 bytes. The partition is 3,584 bytes larger than the reported volume.

`Get-PartitionSupportedSize` reports C: `SizeMax` as **273,326,014,464 bytes**, equal to its current size. `reagentc /info` confirms that Windows Recovery Environment is enabled and uses partition 5. The large amount of free space is inside that active recovery partition; it is not adjacent unallocated space available for a simple online C: extension.

These findings established that the recovery partition had to be replaced before C: could grow. No partitions were changed during the September 15 inspection. Herb authorized the repair on September 16; the outcome follows.

### September 16 partition repair

The oversized partition was replaced with a 2 GiB recovery partition at the end of the existing 1 TiB disk, and C: was extended online. The EFI, reserved and earlier small recovery partitions were left unchanged. The repair followed Microsoft's documented disable/recreate/register/enable WinRE procedure. No VM restart was required.

| Resource                                 | Verified result                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| C: partition size                        | 1,096,598,683,648 bytes, approximately 1,021.29 GiB                                         |
| C: filesystem size                       | 1,096,598,679,552 bytes                                                                     |
| Available C: space at final verification | 241,256,775,680 bytes, approximately 224.69 GiB                                             |
| New recovery partition                   | 2,147,483,648 bytes, at offset 1,097,363,095,552                                            |
| Recovery configuration                   | WinRE enabled on Disk 0 partition 5; version 10.0.26100.9168                                |
| Recovery partition identity              | Microsoft recovery GPT type, required/no-default-letter attributes, no temporary R: mapping |
| Filesystem and services                  | C: healthy and not dirty; SQL Server and SSH running                                        |

The restored `winre.wim` SHA256 matched the original: `4285951B305E7AFA647EF4798D8ADC8D04F2B6837FB2A58543FE7FF14588760C`. WinRE registration and its image were verified; booting into recovery was not tested. The virtual disk capacity is not a promise of physical free space. Parallels Desktop reports available Mac storage to Windows; the host also had approximately 225 GiB free at verification. See [Parallels' release notes](https://kb.parallels.com/en/131014) and [Microsoft's recovery partition procedure](https://support.microsoft.com/en-us/servicing/os/windows/2023/06/kb5028997-instructions-to-manually-resize-your-partition-to-install-the-winre-update).

A rollback snapshot was retained: `Before Windows recovery partition repair 2026-09-16`, ID `8b32f0f4-d0d7-4d0b-afa6-fb5f7f5031f1`. Recovery files, hashes, the prior partition layout and a BCD export were also retained in `C:\ProgramData\drenv-maintenance\2026-09-16-partition` and copied to `~/.local/state/drenv/maintenance/2026-09-16-partition` on the Mac. All four copied recovery files were hash-verified before changing partitions. Reverting the snapshot would also revert later VM work; it is a rollback artifact, not a routine cleanup operation.

## September 16 coordinated source snapshot

Herb explicitly authorized the initial database/blob capture and confirmed that no writers were active. Before capture, inspection found no IIS Express or Azurite processes and no SQL user sessions using dev. The capture used a full COPY_ONLY SQL backup with CHECKSUM. RESTORE VERIFYONLY succeeded, and the backup header confirmed one full checksummed backup of dev. No source database mode was changed.

The capture window was 2026-09-16T08:23:01.9978567Z through 2026-09-16T08:24:12.8293310Z. The source blob directory digest matched before and after capture and matched the saved copy. A final SQL check found no other user sessions using dev. The receipt passed the production TypeScript validator.

- Windows SQL backup: `C:\DevResultsEnvironments\snapshots\dev-20260916-082301\database.bak`
- Windows blobs: `C:\DevResultsEnvironments\snapshots\dev-20260916-082301\blobs`
- Mac receipt: `/Users/herbcaudill/.local/state/drenv/snapshots/dev-20260916/snapshot.json`
- Source selection: dev/example, revision `4dfa564ce5128c261bf70a33cb5f90f8becdc50b`
- SQL restored allocation: 6054281216 bytes; backup SHA256 `bd1c1f45b7430e3606437f0326fa61368ecc1edd31b93303062aca82e61eaa13`
- Blob files: 12339468 bytes; directory SHA256 `cd7a88aaf1c6815cb1cb0b238fbfb1f4013c46f5b6c89482022ed1340e77d2ee`
- Source schema hash: `10845b7aa0c21ca16ee2b04c987ab56573374b7d5a40f610a6c0379f208ccb18`

The database and blob snapshot prerequisite is satisfied. This capture does not establish fresh-build schema compatibility or complete useful-data application acceptance.

## Earlier installation checks

The focused Mac environment suite passed **53 tests**. This includes a new regression that refuses removal of a partial Mac pairing without a verified revision and preserves its marker. The opt-in Windows reservation regression passed against the full lifecycle payload: an empty reservation can be removed without a revision, while a partial Windows source is refused and its file remains unchanged. Both new regressions were observed failing before the fixes. Run the Windows regression with:

```sh
DRENV_WINDOWS_RESERVATION_TEST=1 pnpm exec vitest run scripts/devresults-environments/tests/reservation-windows.test.ts
```

Focused TypeScript checking and diff checks passed. The earlier source, provisioning, supervisor, SQL/blob fixture and hosted schema checks remain documented in their respective contracts; they are not substitutes for the live useful-data proof below.

Those initial installation checks did not establish useful-data application acceptance. The September 16 live checks below add that evidence and distinguish it from the earlier disposable fixtures.

## September 16 useful-data acceptance

The first public creation selected revision `4dfa564ce5128c261bf70a33cb5f90f8becdc50b` and the verified coordinated snapshot. The build exposed an incorrect personal-runner assumption: DevResults emits fixed script and stylesheet names, without a Vite manifest. The runner now requires those actual entry outputs and still fingerprints every executable/client artifact. The Windows regression failed before this correction and passed afterward; the lifecycle fixture passed 26 checks and the focused Mac lifecycle suite passed nine tests.

After that correction, `drenv create proof-one` restored a private catalog and copied the application and blobs. The fresh hosted schema provider computed `78f05887f9c2b7a252a544569230bc5007629d193e6e5792487cbcc2f747db7a`, while the restored database contained `10845b7aa0c21ca16ee2b04c987ab56573374b7d5a40f610a6c0379f208ccb18`. The command refused startup. No schema upgrade ran. This failed environment does not count as a working environment.

The restored catalog had 364 tables, 313 with data, and 5,404,538 rows according to SQL partition metadata. Its data and log files were under `C:\DevResultsEnvironments\runtime\proof-one\sql`, with allocations of 5,140,119,552 and 914,161,664 bytes. Its blob copy exactly matched the receipt's 12,339,468 bytes and SHA256. The restored event history records both schema hashes on September 14 and the snapshot hash most recently on September 15. Source history identifies the report-template branch as the compatible candidate; each new environment must still pass the actual built-provider gate.

After this restore and refusal, the baseline comparison found no changes to the original dev/dev-inl database identities, sizes or states; the primary and report-runtime checkout revisions, tracked status and selected configuration hashes; the original TLS bindings on ports 443, 444 and 44400; or URL reservations. The original IIS/Azurite runtime inventory was empty both before and after. This establishes preservation of the recorded stopped baseline, not survival of running original runtimes. Local evidence is retained under `~/.local/state/drenv/verification/20260916`.

### Successful public-command environments

All three running environments use explicit application revision `66b6f24414de8f0d890e4a35e6af1dbc274d6968`. The freshly built hosted provider computed `10845b7aa0c21ca16ee2b04c987ab56573374b7d5a40f610a6c0379f208ccb18`, matching the independently restored database. The receipt retains the different capture checkout revision. No source database upgrade or schema-gate bypass was needed.

| Environment | Owned catalog     | HTTPS URL                          | Blob / queue / table ports |
| ----------- | ----------------- | ---------------------------------- | -------------------------- |
| proof-two   | drenv_proof_two   | https://example.devlocal.us:20018/ | 20020 / 20021 / 20022      |
| proof-three | drenv_proof_three | https://example.devlocal.us:20024/ | 20026 / 20027 / 20028      |
| proof-four  | drenv_proof_four  | https://example.devlocal.us:20030/ | 20032 / 20033 / 20034      |

Each environment has its own native Mac worktree, private Windows Git store and worktree, deployment, SQL files, Azurite state, cache, temp directory, mail pickup directory, IIS configuration, TLS binding, firewall rule and supervisor Job. The public `create` command selected the source revision and coordinated receipt; public `start` launched each runtime. `proof-four` completed this workflow without manual environment configuration while the other two were running.

The first compatible environment exposed two more personal-runner issues. Generated IIS configuration had dropped the template's global handler delegation, causing HTTP 500.19; the standard build recipe had selected an incompatible SQL spatial DLL on ARM64. The runner now retains that IIS block and selects the existing `msbuild-app-arm` recipe on ARM64. Public `reset proof-two` restored its original owned snapshot after the failed Azurite startup changed emulator metadata, and public `sync proof-two` rebuilt/refreshed its deployment while preserving its data. Existing tracked application files were not edited. A simultaneous creation initially refused the shared provisioning lock and was retried after startup finished.

Dynamic HTTPS also required a Windows firewall rule. Public `start` now creates a token-bound rule limited to its reserved HTTPS port and the Mac SSH peer, `10.211.55.2` in this run. It validates occupied ports before adding access and checks every rule filter before reuse/removal. Existing firewall rules were not changed. Mac HTTPS requests then returned valid-TLS HTTP 302 responses with the expected `X-Drenv-Environment` and revision headers.

### Browser and independence checks

Public `drenv open` opened `proof-two` and `proof-three` in normal Chrome with Herb already signed in. Both dashboards finished loading with 45 projects, project links, an activity map and two populated indicator charts. There was no certificate warning or separate browser profile. Evidence is in `browser-proof-two.json` and `browser-proof-three.json`. The third environment passed public startup and a separate Mac HTTPS identity check; a third rendered-browser check was not claimed because native Chrome control was unavailable at that point.

A temporary source file existed only in the first Mac worktree. It was removed, and both worktrees were clean afterward. Their working-tree Git directories were distinct. A committed temporary SQL row existed only in `drenv_proof_two`, with zero matching rows in `drenv_proof_three` or the source `dev` catalog. The row was then deleted. Through the live storage APIs, a temporary blob round-tripped in the first environment and returned 404 in the second; its temporary container was then removed. Both environments had the copied existing container before that test. No live Azurite files were edited directly.

Public `stop proof-two` and `start proof-two` succeeded. Throughout the stop, the second environment retained the same supervisor/child PIDs and creation times and continued to return the correct healthy HTTP redirect. Creating the third environment likewise left both earlier supervisors and their children unchanged, with both URLs still healthy. The first failed diagnostic environment, `proof-one`, was removed with public `drenv remove`; its registry tombstone remains, and its refusal evidence is retained separately.

The final original-resource comparison still matched the baseline for both source database identities, state and allocated sizes; both original Windows checkout revisions, tracked status and configuration fingerprints; the original TLS bindings; and URL reservations. Original runtimes were off at baseline and were not started for this proof. The final runtime inventory contains the six IIS/Azurite children belonging to the three new environments. Windows reported 202,742,878,208 free bytes after diagnostic cleanup.

### Existing attachment limitation

The primary configuration uses the local development storage emulator, with no cloud-account override and no alternate Azurite data-path override. The original local store and immutable captured copy contain the same 12 files, with zero relative-path or SHA256 differences. Their one container, `devresults-storage-development`, contains 41 INL blobs. The default example database has no nondeleted attachment paths matching that container; sampled legacy example attachment metadata points to an absent production container/blob and returns 404. This limitation was already present in the primary local environment. Available primary blob data was copied faithfully, but no existing example attachment download was demonstrated. No cloud blobs were fetched and no foreign data was changed to fill that gap.

### Final checks and retained evidence

The final focused Mac environment suite passed 53 tests. The Windows provisioning fixture passed 31 checks, the Windows lifecycle fixture passed 38 checks, and the opt-in Windows empty/partial-reservation regression passed. New regressions were observed failing before their respective fixes, including the occupied-port refusal before firewall mutation. These fixture results support the actual public-command and browser evidence above.

Local evidence remains under `~/.local/state/drenv/verification/20260916`: baseline/final inventories, restored-data metadata, source/SQL/blob isolation results, process-survival records, browser checks and Mac HTTPS checks. The three successful environments remain running for use. The installation task remains open pending independent final review.
