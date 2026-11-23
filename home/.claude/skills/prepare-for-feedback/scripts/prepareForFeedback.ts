/**
 * Serve VibeResults and DevResults side by side from the Mac: DevResults from the Parallels VM, forwarded to
 * the Mac, and VibeResults from a dedicated checkout of main whose dev server uses the VM as its backend.
 */
export function prepareForFeedback(deps: Deps, options: Options): FeedbackSetup {
  const { mac, wait, log = () => {} } = deps
  const started: string[] = []

  if (ensureVmRunning(deps)) started.push("VM")
  started.push(...ensureVmSite(deps))
  ensureMacTunnelService(deps)
  ensureForward(deps, "127.0.0.2", DEVRESULTS_PORT, VM_SITE_PORT)
  const vibe = ensureVibeResults(deps, options)
  if (vibe.started) started.push("VibeResults")

  // VibeResults answers only on *.devresultsnext.localhost, which Chrome sends to 127.0.0.1.
  const vibeResults = `https://${options.instance}.devresultsnext.localhost:${vibe.port}`
  const devResults = `https://${options.instance}.devlocal.us:${DEVRESULTS_PORT}`
  const checks = [
    { url: devResults, isUp: isReachable },
    { url: vibeResults, isUp: isReachable },
    // A 401 without a sign-in means the dev server reached the VM's API.
    {
      url: `${vibeResults}/api/admin/data/appsettings`,
      isUp: (status: string) => status === "401",
    },
  ]
  for (const { url, isUp } of checks) {
    log(`Waiting for ${url}`)
    poll(wait, () => isUp(getStatus(mac, url)), `${url} did not respond from the Mac`)
  }

  if (options.open) mac(getOpenScript(vibeResults, devResults))

  return {
    vibeResults,
    devResults,
    started,
    vibeResultsRevision: vibe.revision,
    vibeResultsUpdated: vibe.updated,
    ...getDevResultsRevision(deps),
  }
}

/** Start or resume the VM and wait for SSH. Returns whether it had to. */
function ensureVmRunning({ mac, vm, wait, log = () => {} }: Deps) {
  const status = mac(`prlctl status ${quote(VM_NAME)}`)
    .trim()
    .split(/\s+/)
    .at(-1)
  if (status === "running") return false
  log(`Starting the ${VM_NAME} VM`)
  mac(
    `prlctl ${status === "suspended" || status === "paused" ? "resume" : "start"} ${quote(VM_NAME)}`,
  )
  poll(
    wait,
    () => {
      try {
        return vm("'ok'").trim() === "ok"
      } catch {
        return false
      }
    },
    `The ${VM_NAME} VM did not accept SSH`,
  )
  return true
}

/** Start SQL Server and the primary site in the VM if they're down. Returns what it started. */
function ensureVmSite({ vm, wait, log = () => {} }: Deps) {
  const started: string[] = []
  if (vm("(Get-Service MSSQLSERVER).Status").trim() !== "Running") {
    log("Starting SQL Server in the VM")
    vm("Start-Service MSSQLSERVER")
    started.push("SQL Server")
  }
  const isListening = () =>
    vm(
      `if (Get-NetTCPConnection -State Listen -LocalPort ${VM_SITE_PORT} -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }`,
    ).trim() === "yes"
  if (!isListening()) {
    log("Starting DevResults in the VM")
    // Starts Azurite and IIS Express, each only if its port is free.
    vm(`Start-ScheduledTask '${VM_SITE_TASK}'`)
    started.push("DevResults")
    poll(wait, isListening, `DevResults did not start listening on port ${VM_SITE_PORT} in the VM`)
  }
  return started
}

/** The 127.0.0.2 loopback alias behind *.devlocal.us comes from this service, which launchd can leave stuck after a reboot. */
function ensureMacTunnelService({ mac, wait, log = () => {} }: Deps) {
  const hasAlias = () =>
    mac(`ifconfig lo0 | grep -q 'inet 127.0.0.2 ' && echo yes || echo no`).trim() === "yes"
  if (hasAlias()) return
  log("Reloading the Mac tunnel service; approve sudo in the Terminal window on the Mac")
  mac(getReloadScript())
  poll(
    wait,
    hasAlias,
    "The Mac tunnel service did not come back; check the Terminal window on the Mac",
  )
}

/** Forward a Mac address and port to a VM port, reusing only an SSH listener with the same destination. */
function ensureForward({ mac }: Deps, address: string, port: number, vmPort: number) {
  const forward = `${address}:${port}:127.0.0.1:${vmPort}`
  const listener = getMacListener(mac, address, port)
  if (listener) {
    const isOwned =
      /^(?:\S*\/)?ssh\s/.test(listener) &&
      listener.includes(` -L ${forward} `) &&
      listener.endsWith(` ${VM_HOST}`)
    if (isOwned) return
    throw new Error(`Port ${port} on the Mac is in use by another process: ${listener}`)
  }
  mac(
    `ssh -fN -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L ${forward} ${VM_HOST} > /tmp/feedback-tunnel-${port}.log 2>&1 < /dev/null`,
  )
}

/**
 * Bring the feedback checkout to origin/main and make sure its dev server runs against the VM. The checkout
 * is a worktree of the main checkout, so it never shares Vite's dependency cache with Herb's own dev server.
 */
function ensureVibeResults(deps: Deps, { repository, checkout }: Options) {
  const { mac, wait, log = () => {} } = deps
  const exists = mac(`[ -d ${quote(checkout)} ] && echo yes || echo no`).trim() === "yes"
  if (!exists) {
    log(`Creating ${checkout} at origin/main`)
    mac(
      `git -C ${quote(repository)} fetch --quiet origin main && git -C ${quote(repository)} worktree add --quiet --detach ${quote(checkout)} origin/main && cd ${quote(checkout)} && node scripts/worktree.mjs setup --no-db > /tmp/feedback-setup.log 2>&1`,
    )
  }
  const isBehind =
    exists &&
    new Set(
      mac(
        `git -C ${quote(checkout)} fetch --quiet origin main && git -C ${quote(checkout)} rev-parse HEAD origin/main`,
      )
        .trim()
        .split("\n"),
    ).size > 1
  if (isBehind && mac(`git -C ${quote(checkout)} status --porcelain`).trim())
    throw new Error(`${checkout} has local changes, so it can't move to origin/main`)

  const port = Number(mac(`sed -n 's/^APP_HTTPS_PORT=//p' ${quote(`${checkout}/.env`)}`).trim())
  if (!port) throw new Error(`${checkout}/.env has no APP_HTTPS_PORT`)

  const server = getDevServer(mac, port)
  if (server && !server.command.includes(`${checkout}/apps/web/`))
    throw new Error(`Port ${port} on the Mac is in use by another process: ${server.command}`)
  const isCurrent = !isBehind && server?.command.includes(`DEVRESULTS_ORIGIN=${VM_ORIGIN}`) === true
  if (server && !isCurrent) {
    mac(`kill ${server.pid}`)
    poll(wait, () => !getDevServer(mac, port), `The dev server on port ${port} did not stop`)
  }
  if (isBehind) {
    log(`Moving ${checkout} to origin/main`)
    mac(
      `cd ${quote(checkout)} && git checkout --quiet --detach origin/main && pnpm install --prefer-offline --frozen-lockfile > /tmp/feedback-install.log 2>&1`,
    )
  }
  if (!isCurrent) {
    log("Starting VibeResults")
    mac(
      // The app imports the SDK's build, which a new or moved checkout lacks. It takes a few seconds.
      // The whole list runs detached, with its own output, so it doesn't hold this script's pipe open.
      `(cd ${quote(checkout)} && pnpm sdk:build && cd apps/web && DEVRESULTS_ORIGIN=${VM_ORIGIN} BROWSER=none exec nohup pnpm dev) > /tmp/feedback-vibe-results.log 2>&1 < /dev/null &`,
    )
    poll(wait, () => Boolean(getDevServer(mac, port)), `VibeResults did not start on port ${port}`)
  }

  return {
    port,
    started: !isCurrent,
    updated: !exists || isBehind,
    revision: mac(`git -C ${quote(checkout)} rev-parse --short HEAD`).trim(),
  }
}

/** The process listening on a loopback port, with its environment, since that names the dev server's backend. */
function getDevServer(mac: Deps["mac"], port: number) {
  const output = mac(
    `pid=$(lsof -nP -a -t -iTCP@127.0.0.1:${port} -sTCP:LISTEN | head -n 1); if [ -n "$pid" ]; then ps eww -o pid=,command= -p "$pid"; fi`,
  ).trim()
  const match = output.match(/^(\d+)\s+(.*)$/s)
  return match ? { pid: Number(match[1]), command: match[2] } : undefined
}

/** The command line of whatever listens on an address and port on the Mac, or an empty string. */
function getMacListener(mac: Deps["mac"], address: string, port: number) {
  return mac(
    `pid=$(lsof -nP -a -t -iTCP@${address}:${port} -sTCP:LISTEN | head -n 1); if [ -n "$pid" ]; then ps -p "$pid" -o command=; fi`,
  ).trim()
}

/** The VM checkout's branch and commit, and how many commits of origin/main it lacks. */
function getDevResultsRevision({ vm }: Deps) {
  const git = `git -C ${VM_CHECKOUT}`
  const [branch, revision, behind] = vm(
    `${git} fetch --quiet origin main; ${git} rev-parse --abbrev-ref HEAD; ${git} rev-parse --short HEAD; ${git} rev-list --count HEAD..origin/main`,
  )
    .trim()
    .split(/\r?\n/)
  const count = Number.parseInt(behind ?? "", 10)
  return {
    devResultsBranch: branch,
    devResultsRevision: revision,
    devResultsCommitsBehind: Number.isNaN(count) ? null : count,
  }
}

/** Certificates aren't checked, since curl doesn't trust the local dev server's mkcert authority. */
function getStatus(mac: Deps["mac"], url: string) {
  return mac(`curl -ksS -o /dev/null -m 120 -w '%{http_code}' ${url} 2>/dev/null || true`).trim()
}

/** A redirect counts, because DevResults answers its root with one. */
function isReachable(status: string) {
  return /^[23]\d\d$/.test(status)
}

/** Retry a check for up to five minutes, since a cold site can take that long. */
function poll(wait: Deps["wait"], check: () => boolean, failure: string) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (check()) return
    wait(POLL_INTERVAL_MS)
  }
  throw new Error(failure)
}

function quote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** Sudo needs a real terminal to prompt, which a script run by an agent doesn't have. */
function getReloadScript() {
  const plist = `/Library/LaunchDaemons/${TUNNEL_SERVICE}.plist`
  return `cat > /tmp/reload-devlocal.command <<'EOF'
#!/bin/bash
echo "Reloading ${TUNNEL_SERVICE}"
sudo /bin/bash -c "launchctl bootout system/${TUNNEL_SERVICE}; sleep 1; launchctl bootstrap system ${plist}"
echo "Done. You can close this window."
EOF
chmod +x /tmp/reload-devlocal.command
open -a Terminal /tmp/reload-devlocal.command`
}

/** Tile VibeResults on the left and DevResults on the right on the current desktop, falling back to plain tabs. */
function getOpenScript(left: string, right: string) {
  return `osascript -l JavaScript - '${left}' '${right}' <<'EOF' || open -a "Google Chrome" '${left}' '${right}'
ObjC.import("AppKit")
function run([left, right]) {
  const screen = $.NSScreen.screens.objectAtIndex(0)
  const visible = screen.visibleFrame
  const top = screen.frame.size.height - visible.origin.y - visible.size.height
  const width = Math.floor(visible.size.width / 2)
  const chrome = Application("Google Chrome")
  ;[left, right].forEach((url, index) => {
    const window = chrome.Window().make()
    window.activeTab.url = url
    window.bounds = { x: visible.origin.x + index * width, y: top, width, height: visible.size.height }
  })
  chrome.activate()
}
EOF`
}

// CONSTANTS

const VM_NAME = "Windows 11"
const VM_HOST = "devresults-vm"
/** The VM's Parallels address, as in the `devresults-vm` SSH host. */
const VM_ORIGIN = "https://10.211.55.3"
const VM_CHECKOUT = "C:\\Code\\DevResults"
const VM_SITE_PORT = 443
const VM_SITE_TASK = "DevResults Local Services"
/** The Mac port for DevResults on 127.0.0.2, which leaves 443 to the mini's primary site. */
const DEVRESULTS_PORT = 8443
const TUNNEL_SERVICE = "com.herbcaudill.devlocal-mini-tunnel"
const POLL_ATTEMPTS = 60
const POLL_INTERVAL_MS = 5000

// TYPES

/** How the setup reaches each machine. */
export type Deps = {
  /** Run a PowerShell script in the VM and return its output. Throws when the VM can't be reached. */
  vm: (script: string) => string
  /** Run a Bash script on the Mac and return its output. */
  mac: (script: string) => string
  /** Pause between checks. */
  wait: (milliseconds: number) => void
  /** Report progress. */
  log?: (message: string) => void
}

/** What to set up. */
export type Options = {
  /** The instance subdomain to open on both sites. */
  instance: string
  /** Whether to open the browser windows. */
  open: boolean
  /** The main devresults-next checkout. */
  repository: string
  /** The worktree that serves VibeResults for feedback. */
  checkout: string
}

/** The finished setup. */
export type FeedbackSetup = {
  /** VibeResults URL on the Mac. */
  vibeResults: string
  /** DevResults URL on the Mac. */
  devResults: string
  /** What had to be started. */
  started: string[]
  /** The commit VibeResults serves. */
  vibeResultsRevision: string
  /** Whether the VibeResults checkout was created or moved to origin/main on this run. */
  vibeResultsUpdated: boolean
  /** The VM checkout's branch. */
  devResultsBranch: string | undefined
  /** The VM checkout's commit, which is normally what its site was last built from. */
  devResultsRevision: string | undefined
  /** Commits on origin/main that the VM checkout lacks. */
  devResultsCommitsBehind: number | null
}
