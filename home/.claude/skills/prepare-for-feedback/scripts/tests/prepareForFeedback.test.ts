import { describe, expect, it } from "vitest"
import { prepareForFeedback } from "../prepareForFeedback.ts"

const CHECKOUT = "/Users/herb/Code/DevResults/devresults-next-feedback"
const options = {
  instance: "loura",
  open: true,
  repository: "/Users/herb/Code/DevResults/devresults-next",
  checkout: CHECKOUT,
}

describe("prepareForFeedback", () => {
  it("starts the VM, its site and VibeResults when everything is down", () => {
    const world = createWorld({ vm: "stopped", sql: false, site: false })
    const result = prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).toContain("prlctl start 'Windows 11'")
    expect(world.vmScripts.join("\n")).toContain("Start-Service MSSQLSERVER")
    expect(world.vmScripts.join("\n")).toContain("Start-ScheduledTask 'DevResults Local Services'")
    expect(result.started).toEqual(["VM", "SQL Server", "DevResults", "VibeResults"])
  })

  it("resumes a suspended VM", () => {
    const world = createWorld({ vm: "suspended" })
    prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).toContain("prlctl resume 'Windows 11'")
  })

  it("reuses running sites and reports the URLs for the chosen instance", () => {
    const world = createWorld({ vibeResults: VM_DEV_SERVER })
    const result = prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).not.toMatch(/prlctl (start|resume)|pnpm dev/)
    expect(world.vmScripts.join("\n")).not.toMatch(/Start-Service|Start-ScheduledTask/)
    expect(result).toMatchObject({
      vibeResults: "https://loura.devresultsnext.localhost:30011",
      devResults: "https://loura.devlocal.us:8443",
      started: [],
    })
  })

  it("forwards DevResults from the VM on the address its Mac hostname resolves to", () => {
    const world = createWorld()
    prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).toContain("-L 127.0.0.2:8443:127.0.0.1:443 devresults-vm")
  })

  it("reuses a forward that already goes to the VM", () => {
    const world = createWorld({
      macListeners: { "127.0.0.2:8443": "ssh -fN -L 127.0.0.2:8443:127.0.0.1:443 devresults-vm" },
    })
    prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).not.toContain(
      "-L 127.0.0.2:8443:127.0.0.1:443 devresults-vm >",
    )
  })

  it("leaves a foreign listener alone and says so", () => {
    const world = createWorld({
      macListeners: { "127.0.0.2:8443": "ssh -fN -L 127.0.0.2:8443:x mini" },
    })
    expect(() => prepareForFeedback(world.deps, options)).toThrow(/8443.*mini/)
  })

  it("runs VibeResults from the feedback checkout against the VM", () => {
    const world = createWorld()
    prepareForFeedback(world.deps, options)
    const start = world.macScripts.find(script => script.includes("pnpm dev"))
    // The app imports the SDK's build, which a new or moved checkout lacks.
    expect(start).toMatch(/pnpm sdk:build .*&& cd apps\/web/)
    expect(start).toContain("DEVRESULTS_ORIGIN=https://10.211.55.3")
    expect(start).toContain("BROWSER=none")
  })

  it("creates the feedback checkout at origin/main when it is missing", () => {
    const world = createWorld({ hasCheckout: false })
    prepareForFeedback(world.deps, options)
    const script = world.macScripts.join("\n")
    expect(script).toContain(`worktree add --quiet --detach '${CHECKOUT}' origin/main`)
    expect(script).toContain("node scripts/worktree.mjs setup --no-db")
  })

  it("moves a checkout behind main to main and restarts its dev server", () => {
    const world = createWorld({ checkoutBehind: true, vibeResults: VM_DEV_SERVER })
    const result = prepareForFeedback(world.deps, options)
    const script = world.macScripts.join("\n")
    expect(script).toContain("checkout --quiet --detach origin/main")
    expect(script).toContain("kill 4242")
    expect(result.vibeResultsUpdated).toBe(true)
    expect(result.started).toContain("VibeResults")
  })

  it("refuses to move a checkout with local changes", () => {
    const world = createWorld({ checkoutBehind: true, checkoutDirty: true })
    expect(() => prepareForFeedback(world.deps, options)).toThrow(/local changes/)
  })

  it("restarts its own dev server when it isn't using the VM", () => {
    const world = createWorld({ vibeResults: DEV_SERVER })
    const result = prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).toContain("kill 4242")
    expect(result.started).toContain("VibeResults")
  })

  it("leaves a dev server from another checkout alone and says so", () => {
    const world = createWorld({
      vibeResults: "node /elsewhere/apps/web/node_modules/@react-router/dev/bin.js dev",
    })
    expect(() => prepareForFeedback(world.deps, options)).toThrow(/30011.*elsewhere/)
  })

  it("reports how far DevResults is behind main", () => {
    const world = createWorld()
    expect(prepareForFeedback(world.deps, options)).toMatchObject({
      devResultsBranch: "main",
      devResultsRevision: "d33ad64",
      devResultsCommitsBehind: 3,
    })
  })

  it("reloads the Mac tunnel service when its loopback address is missing", () => {
    const world = createWorld({ macAlias: false })
    prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).toContain(
      "launchctl bootstrap system /Library/LaunchDaemons/com.herbcaudill.devlocal-mini-tunnel.plist",
    )
  })

  it("does not open browsers when asked not to", () => {
    const world = createWorld()
    prepareForFeedback(world.deps, { ...options, open: false })
    expect(world.macScripts.join("\n")).not.toContain("Google Chrome")
  })
})

const DEV_SERVER = `node ${CHECKOUT}/apps/web/node_modules/.bin/../@react-router/dev/bin.js dev`
const VM_DEV_SERVER = `${DEV_SERVER} DEVRESULTS_ORIGIN=https://10.211.55.3 BROWSER=none`

/** Fake the Mac and the VM so each service comes up when it is started. */
function createWorld({
  vm = "running",
  sql = true,
  site = true,
  macAlias = true,
  macListeners = {},
  vibeResults,
  hasCheckout = true,
  checkoutBehind = false,
  checkoutDirty = false,
}: {
  vm?: "running" | "stopped" | "suspended"
  sql?: boolean
  site?: boolean
  macAlias?: boolean
  macListeners?: Record<string, string>
  /** What `ps eww` shows for the dev server on the checkout's port, if one runs. */
  vibeResults?: string
  hasCheckout?: boolean
  checkoutBehind?: boolean
  checkoutDirty?: boolean
} = {}) {
  const vmScripts: string[] = []
  const macScripts: string[] = []
  const state = {
    vm,
    sql,
    site,
    alias: macAlias,
    vibeResults,
    hasCheckout,
    behind: checkoutBehind,
  }

  const vmShell = (script: string) => {
    vmScripts.push(script)
    if (state.vm !== "running") throw new Error("ssh: connect to host devresults-vm: timed out")
    if (script.includes("Start-Service MSSQLSERVER")) state.sql = true
    if (script.includes("(Get-Service MSSQLSERVER).Status"))
      return state.sql ? "Running" : "Stopped"
    if (script.includes("Start-ScheduledTask")) state.site = true
    if (script.includes("-LocalPort 443")) return state.site ? "yes" : "no"
    if (script.includes("rev-list")) return "main\nd33ad64\n3\n"
    return "ok"
  }

  const mac = (script: string) => {
    macScripts.push(script)
    if (script.includes("prlctl status")) return `VM Windows 11 exist ${state.vm}`
    if (/prlctl (start|resume)/.test(script)) state.vm = "running"
    if (script.includes("launchctl bootstrap")) state.alias = true
    if (script.includes("ifconfig lo0")) return state.alias ? "yes" : "no"
    if (script.includes("[ -d ")) return state.hasCheckout ? "yes" : "no"
    if (script.includes("worktree add")) state.hasCheckout = true
    if (script.includes("APP_HTTPS_PORT")) return "30011"
    if (script.includes("status --porcelain"))
      return checkoutDirty ? " M apps/web/src/root.tsx" : ""
    if (script.includes("rev-parse HEAD origin/main")) return state.behind ? "aaa\nbbb" : "bbb\nbbb"
    if (script.includes("checkout --quiet --detach")) state.behind = false
    if (script.includes("rev-parse --short HEAD")) return "bbb1234"
    if (script.includes("kill 4242")) state.vibeResults = undefined
    if (script.includes("pnpm dev")) state.vibeResults = VM_DEV_SERVER
    if (script.includes("ps eww")) return state.vibeResults ? `4242 ${state.vibeResults}` : ""
    const listener = script.match(/-iTCP@([\d.]+:\d+)/)?.[1]
    if (listener) return macListeners[listener] ?? ""
    if (script.includes("/api/")) return "401"
    if (script.includes("%{http_code}")) return "200"
    return ""
  }

  return { deps: { vm: vmShell, mac, wait: () => {} }, vmScripts, macScripts }
}
