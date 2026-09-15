# Installation and public-command evidence

Verified on September 15, 2026. The public command is installed and its bounded source/preset/refusal/cleanup checks passed. Complete useful-data environment acceptance remains blocked by the missing coordinated source snapshot and Windows disk capacity.

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

## Concrete remaining prerequisites

A final read-only sizing check measured C: free space at **4,405,739,520 bytes (4.10 GiB)**. Source SQL allocation was **6,054,281,216 bytes (5.64 GiB)** for `dev` and **43,570,429,952 bytes (40.58 GiB)** for `dev-inl`. The deployable application copy measured **567,846,866 bytes** after excluding build-only dependencies. Existing source Azurite files totaled **12,339,468 bytes**; measuring live files is not a coordinated snapshot.

| Selection                 | Measured SQL + app + blob + 2 GiB provisioning headroom | Shortfall against that C: reading |
| ------------------------- | ------------------------------------------------------- | --------------------------------- |
| Default `dev` / `example` | 8,781,951,198 bytes (8.18 GiB)                          | 4.08 GiB                          |
| INL `dev-inl` / `inl`     | 46,298,099,934 bytes (43.12 GiB)                        | 39.02 GiB                         |

These are lower bounds for one environment. Additional native source copies, package dependencies, build output outside the deployment, and any snapshot artifacts stored on C: need their own space. Three default useful-data environments would require at least approximately 20.54 GiB free for their SQL/app/blob copies and shared remaining 2 GiB headroom, before those additional costs. The partition layout findings below identify the capacity prerequisite. Remeasure C: after approved maintenance and before creating the environments. Existing data must not be deleted merely to make room.

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

The next capacity step is **maintenance of the recovery partition layout before extending C:**. It requires a verified backup and explicit approval for the partition changes, including preservation or re-establishment of working WinRE. Increasing the Parallels virtual disk size alone does not resolve this layout. No partition, recovery configuration or disk size was changed during this inspection or documentation update. Useful-data environment creation and live acceptance proof remain blocked on that maintenance and the coordinated snapshot below.

The other prerequisite is an immutable coordinated SQL/blob snapshot with a verified receipt. None was supplied or created during installation. Absence of IIS listeners does not prove that all SQL/blob writers are excluded. Initial source capture still requires explicit coordination; the public `snapshot` command is for an already owned environment.

## Tests and acceptance boundary

The focused Mac environment suite passed **53 tests**. This includes a new regression that refuses removal of a partial Mac pairing without a verified revision and preserves its marker. The opt-in Windows reservation regression passed against the full lifecycle payload: an empty reservation can be removed without a revision, while a partial Windows source is refused and its file remains unchanged. Both new regressions were observed failing before the fixes. Run the Windows regression with:

```sh
DRENV_WINDOWS_RESERVATION_TEST=1 pnpm exec vitest run scripts/devresults-environments/tests/reservation-windows.test.ts
```

Focused TypeScript checking and diff checks passed. The earlier source, provisioning, supervisor, SQL/blob fixture and hosted schema checks remain documented in their respective contracts; they are not substitutes for the missing useful-data proof.

Still unperformed: create and start two useful-data DevResults environments through `drenv`; demonstrate independent source/data/process behavior; create a third without manual configuration; verify working pages in normal Chrome; and demonstrate running original environments surviving those operations. The installation and bounded guard checks are complete, while this live acceptance evidence remains incomplete.
