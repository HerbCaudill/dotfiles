# Shared HTTPS localhost routing

Dotfiles installs Portless 0.15.6 and `localhost-dev` through Nix. The release tarball is pinned by version and SHA-256, and the executable uses Nix's Node 24, Git, and OpenSSL. Portless's published CLI is bundled and has no runtime npm dependencies.

`pnpm nix:rebuild` generates the local certificate authority and adds it to the macOS system trust store. It installs the root LaunchDaemon `com.herbcaudill.localhost-router`, which starts at boot and restarts after exit. The proxy serves HTTPS on port 443 and redirects HTTP on port 80 when that port is available. It binds only IPv4 and IPv6 loopback. LAN access, wildcard fallback, hosts-file writes, and tunnels are disabled by the managed configuration.

Shared routes and certificates live in `~/.portless`, using Portless's native registry and locks. Application processes register their own names and receive automatically allocated upstream ports. The app launcher requires the managed proxy to be ready; it never asks an application startup to install certificates or elevate privileges.

## Integrate a project

Give the raw server a named package script and route the complete development command through the managed launcher:

```json
{
  "scripts": {
    "dev": "localhost-dev pnpm dev:app",
    "dev:app": "vite",
    "dev:url": "localhost-dev url"
  }
}
```

`pnpm dev` then uses `https://<origin-repository-name>.localhost`. The Git origin remote supplies the repository name; without origin, the main checkout folder is the fallback. Linked worktrees add their folder name, including detached checkouts. A Tasks worktree folder named `tofu` gets `https://tofu.tasks.localhost`, regardless of its branch. Names are lowercased, unsupported characters become hyphens, and invalid or overlong DNS labels fail instead of truncating. Two names that normalize to the same address get Portless's duplicate-owner error.

For another service, use `localhost-dev --service api pnpm dev:api`. Its address is `https://api.tasks.localhost` in the main checkout or `https://tofu.api.tasks.localhost` in that worktree. Required services must start and stop together through the project's `pnpm dev` workflow.

Vite must listen on loopback at `PORT` with `strictPort: true`. Use `PORTLESS_URL` for allowed hostnames and the public HMR address: `wss`, its hostname, and client port 443. Keep the raw server script available for isolated tests and environments without this Mac's managed proxy. Tasks is the first integrated project; its isolated browser suites still start their own direct servers and never reuse a development server.

## Inspect and recover

- `localhost-dev url` prints this checkout's address without starting anything.
- `localhost-dev routes` lists registrations and assigned upstream ports.
- `localhost-dev doctor` checks the running proxy, trust, and hostname resolution.
- `localhost-dev recover` prunes dead-owner registrations through Portless's public API. It does not kill app processes.
- `sudo launchctl print system/com.herbcaudill.localhost-router` shows the managed service state.
- `sudo tail -n 50 ~/.portless/service.log` reads the root service log.

Ctrl+C forwards one signal to the session's Portless process, which stops its app tree and removes its route. The shared proxy stays up. SIGKILL can leave an orphan; inspect it before stopping it and use `recover` to remove dead-owner registrations. Do not use `portless --force`, `prune`, or `clean` for routine startup. Do not hand-edit the live registry. Do not run Portless's separate `service install` command alongside the Nix-managed service.

To pause the proxy, use `sudo launchctl bootout system/com.herbcaudill.localhost-router`; `pnpm nix:rebuild` loads the service again. Permanent removal belongs in `nix/darwin/localhost-router.nix` followed by a rebuild. Removing the service does not remove the CA from system trust; untrust it explicitly with the matching Portless state if retiring this setup.

## Browser storage

A hostname is a browser origin. `https://tasks.localhost` has separate IndexedDB, OPFS, local storage, and service workers from `http://localhost:5180`, and each worktree has separate storage. Existing storage is left intact. Use Tasks' device-linking flow to enroll the new address rather than creating a replacement board or deleting an old replica. The local proxy does not change the public deployment or expose this Mac to phones or other devices. Tasks' existing DXOS synchronization services remain external dependencies.

## Verification

The naming and service-label tests run with `pnpm exec vitest run scripts/localhost-router/tests/getLaunchSettings.test.ts`. Nix builds and validates the package and launchd configuration. In Tasks, `pnpm test:routing` verifies trusted Chrome HTTPS, the exact checkout and fresh process identity, the public WebSocket address, and a simultaneous detached worktree with a real hot update that preserves page state. It uses temporary Chrome contexts, a unique service name, graceful shutdown, and removes only its own temporary worktree. Node's test driver uses `NODE_USE_SYSTEM_CA=1`; browser certificate verification remains enabled.
