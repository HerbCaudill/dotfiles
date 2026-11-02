/** Bring up VibeResults and a DevResults environment on the mini, forward both to the Mac, and open them. */
export function prepareForFeedback(deps: Deps, options: Options): FeedbackSetup {
  const { mini, mac, wait, log = () => {} } = deps
  const environment = findEnvironment(mini, options.environment)
  const legacyPort = environment.ports.https
  const started: string[] = []

  const isListening = (port: number) =>
    mini(
      `if (Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }`,
    ).trim() === "yes"

  const ensureListening = (port: number, name: string, start: string) => {
    if (isListening(port)) return
    log(`Starting ${name}`)
    mini(start)
    started.push(name)
    poll(
      wait,
      () => isListening(port),
      `${name} did not start listening on port ${port} on the mini`,
    )
  }

  ensureListening(PRIMARY_PORT, "primary DevResults", "Start-ScheduledTask 'DevResults site'")
  ensureListening(VIBE_PORT, "VibeResults", "Start-ScheduledTask 'VibeResults dev'")
  ensureListening(legacyPort, options.environment, `${DRENV} start ${options.environment}`)

  ensureMacTunnelService(deps)
  ensureForward(deps, "127.0.0.2", legacyPort)
  ensureForward(deps, "127.0.0.1", VIBE_PORT)

  const vibeResults = `https://${options.instance}.viberesults.dev:${VIBE_PORT}`
  const devResults = `https://${options.instance}.devlocal.us:${legacyPort}`
  for (const url of [vibeResults, devResults]) {
    log(`Waiting for ${url}`)
    poll(wait, () => respondsFromMac(mac, url), `${url} did not respond from the Mac`)
  }

  if (options.open) mac(getOpenScript(vibeResults, devResults))

  return {
    vibeResults,
    devResults,
    started,
    revision: environment.revision,
    commitsBehind: getCommitsBehind(mini, environment),
  }
}

/** Read one environment from the mini's registry. */
function findEnvironment(mini: Deps["mini"], id: string) {
  const output = mini(`${DRENV} status`)
  const environments = JSON.parse(output.slice(output.indexOf("["))) as Environment[]
  const environment = environments.find(candidate => candidate.id === id)
  if (!environment) throw new Error(`The mini has no environment named ${id}`)
  if (!["running", "stopped"].includes(environment.phase))
    throw new Error(`Environment ${id} is ${environment.phase}; inspect it with drenv first`)
  return environment
}

/** Restore the service behind *.devlocal.us, which launchd can leave stuck after a Mac reboot. */
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

/** Open a forward, reusing only an SSH listener with the same destination. */
function ensureForward({ mac }: Deps, address: string, port: number) {
  const forward = `${address}:${port}:127.0.0.1:${port}`
  const listener = mac(
    `pid=$(lsof -nP -a -t -iTCP@${address}:${port} -sTCP:LISTEN | head -n 1); if [ -n "$pid" ]; then ps -p "$pid" -o command=; fi`,
  ).trim()
  if (listener) {
    const isOwned =
      /^(?:\S*\/)?ssh\s/.test(listener) &&
      listener.includes(` -L ${forward} `) &&
      listener.endsWith(" mini")
    if (isOwned) return
    throw new Error(`Port ${port} on the Mac is in use by another process: ${listener}`)
  }
  mac(
    `ssh -fN -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L ${forward} mini > /tmp/feedback-tunnel-${port}.log 2>&1 < /dev/null`,
  )
}

/** A redirect counts, because DevResults answers its root with one. */
function respondsFromMac(mac: Deps["mac"], url: string) {
  const status = mac(
    `curl -sS -o /dev/null -m 120 -w '%{http_code}' ${url} 2>/dev/null || true`,
  ).trim()
  return /^[23]\d\d$/.test(status)
}

/** Count the commits the environment's build lacks, when it follows a remote branch. */
function getCommitsBehind(mini: Deps["mini"], { requestedRevision, revision }: Environment) {
  if (!requestedRevision?.startsWith("origin/")) return null
  const branch = requestedRevision.slice("origin/".length)
  const output = mini(
    `git -C ${PRIMARY_CHECKOUT} fetch --quiet origin ${branch}; git -C ${PRIMARY_CHECKOUT} rev-list --count ${revision}..${requestedRevision}`,
  )
  const count = Number.parseInt(output.trim(), 10)
  return Number.isNaN(count) ? null : count
}

/** Retry a check for up to five minutes, since a cold site can take that long. */
function poll(wait: Deps["wait"], check: () => boolean, failure: string) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (check()) return
    wait(POLL_INTERVAL_MS)
  }
  throw new Error(failure)
}

/** Sudo needs a real terminal to prompt, which an SSH session doesn't have. */
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

/** Tile VibeResults on the left and DevResults on the right on desktop 2, falling back to plain tabs. */
function getOpenScript(left: string, right: string) {
  return `osascript -l JavaScript - '${left}' '${right}' <<'EOF' || open -a "Google Chrome" '${left}' '${right}'
ObjC.import("AppKit")
function run([left, right]) {
  try {
    Application("System Events").keyCode(19, { using: "control down" })
    delay(1.5)
  } catch {}
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

const DRENV = `& "$env:USERPROFILE\\.local\\bin\\drenv.cmd"`
const PRIMARY_CHECKOUT = "C:\\Code\\DevResults\\devresults"
const PRIMARY_PORT = 8443
const VIBE_PORT = 9443
const TUNNEL_SERVICE = "com.herbcaudill.devlocal-mini-tunnel"
const POLL_ATTEMPTS = 60
const POLL_INTERVAL_MS = 5000

// TYPES

/** How the setup reaches each machine. */
export type Deps = {
  /** Run a PowerShell script on the mini and return its output. */
  mini: (script: string) => string
  /** Run a Bash script on the Mac and return its output. */
  mac: (script: string) => string
  /** Pause between checks. */
  wait: (milliseconds: number) => void
  /** Report progress. */
  log?: (message: string) => void
}

/** What to set up. */
export type Options = {
  /** The drenv environment that serves DevResults. */
  environment: string
  /** The instance subdomain to open on both sites. */
  instance: string
  /** Whether to open the browser windows on the Mac. */
  open: boolean
}

/** The finished setup. */
export type FeedbackSetup = {
  /** VibeResults URL on the Mac. */
  vibeResults: string
  /** DevResults URL on the Mac. */
  devResults: string
  /** The sites that had to be started. */
  started: string[]
  /** The commit the DevResults environment was built from. */
  revision: string
  /** Commits on the environment's branch that its build lacks, if it follows one. */
  commitsBehind: number | null
}

type Environment = {
  id: string
  phase: string
  revision: string
  requestedRevision?: string
  ports: { https: number }
}
