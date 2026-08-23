---
name: publishing-to-npm
description: Use to publish or release any JavaScript package to npm.
---

# Publishing to npm

Publish the intended artifact, handle authentication interactively, and verify the exact release on the registry. Do not stop at instructions when the user asked for publication.

## Inspect the release

1. Read the repository instructions and `package.json`. Identify the package root or workspace, package manager, release tooling, `name`, `version`, `private`, `files`, lifecycle scripts, and `publishConfig`.
2. Prefer the repository's release command or tool when one exists. Use raw `npm publish` only when the repository has no release workflow.
3. Run `git status --short`. Do not discard unrelated changes. Make sure the package contents represent the source state the user intends to release.
4. Stop if `"private": true` unless the user explicitly authorizes changing it.
5. Check the effective registry with `npm config get registry`. Honor `publishConfig.registry` and scoped registry configuration.
6. Query the exact version before publishing:

```bash
npm view <name>@<version> version --json --registry=<registry>
```

An `E404` means the version is available. Treat authentication, permission, and network errors as real failures. Never invent or automatically bump a version when it already exists.

## Verify the artifact

Run the repository's relevant tests and build. If release metadata such as the version or changelog must change, use the repository's tooling, commit the intended files, and push before publishing.

Preview the exact package contents:

```bash
npm pack --dry-run --json
```

Inspect the file list, entry points, declarations, package size, and lifecycle output. Do not publish secrets, local configuration, source maps containing private source, or unintended build artifacts.

Resolve the release tuple before the final command:

- Exact package name and version
- Registry
- Workspace, if any
- Access level
- Dist-tag

Use `--access public` for the first public release of a scoped package unless `publishConfig.access` already provides it. Unscoped packages are public. Never publish a prerelease under `latest` unless the user explicitly requests it; follow the repository's established tag convention or ask which tag to use.

## Authenticate interactively

Check the active npm identity against the target registry:

```bash
npm whoami --registry=<registry>
```

If authentication is missing or the identity is wrong, run the following command yourself in an interactive terminal or PTY:

```bash
npm login --registry=<registry>
```

Keep that terminal session alive. Tell the user that npm is waiting for browser or two-factor authentication, then wait on the same session in bounded intervals until they finish. Do not ask the user to run `npm login` in another terminal, and do not abandon the command because it pauses for human input.

Never ask the user to paste a password, access token, or one-time code into chat. Let them authenticate in npm's browser or terminal flow. Do not print or inspect `.npmrc` credentials. After login completes, rerun `npm whoami` and verify the expected account.

## Publish

Briefly state the exact `<name>@<version>`, registry, access, and dist-tag being published, then execute without asking for redundant confirmation when the user's request already authorized publication.

Use the repository's release command when present. Otherwise construct the minimal applicable command:

```bash
npm publish [--workspace=<workspace>] [--access public] [--tag <tag>]
```

Run publishing in an interactive PTY so npm can complete two-factor authentication. If npm pauses for browser or terminal authentication, keep the session alive and wait for the user as with `npm login`.

Never use `--force`. If the command disconnects, times out, or returns an ambiguous result, query `<name>@<version>` before retrying. The registry may have accepted the immutable version even when the local process did not receive a clean response.

## Verify the release

Confirm the exact version and its dist-tag from the target registry:

```bash
npm view <name>@<version> version dist.tarball --json --registry=<registry>
npm view <name> dist-tags --json --registry=<registry>
```

If registry propagation is briefly delayed, retry the read-only query for a short bounded period. Report the published package and version, registry, access, dist-tag, and verification result. Include the npm package URL for public packages.
