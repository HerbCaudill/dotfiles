import { describe, expect, it } from "vitest"
import { prepareForFeedback } from "../prepareForFeedback.ts"

const options = { environment: "compare-design-refresh", instance: "loura", open: true }

describe("prepareForFeedback", () => {
  it("starts only the sites that are down", () => {
    const world = createWorld({ listening: [8443] })
    prepareForFeedback(world.deps, options)
    expect(world.miniScripts.some(script => script.includes("start compare-design-refresh"))).toBe(
      true,
    )
    expect(
      world.miniScripts.some(script => script.includes("Start-ScheduledTask 'VibeResults dev'")),
    ).toBe(true)
    expect(
      world.miniScripts.some(script => script.includes("Start-ScheduledTask 'DevResults site'")),
    ).toBe(false)
  })

  it("reuses running sites and reports the URLs for the chosen instance", () => {
    const world = createWorld({ listening: [8443, 9443, 30039] })
    const result = prepareForFeedback(world.deps, options)
    expect(world.miniScripts.join("\n")).not.toMatch(/Start-ScheduledTask| start /)
    expect(result).toMatchObject({
      vibeResults: "https://loura.viberesults.dev:9443",
      devResults: "https://loura.devlocal.us:30039",
    })
  })

  it("forwards each site on the address its Mac hostname resolves to", () => {
    const world = createWorld({ listening: [8443, 9443, 30039] })
    prepareForFeedback(world.deps, options)
    const script = world.macScripts.join("\n")
    expect(script).toContain("-L 127.0.0.2:30039:127.0.0.1:30039")
    expect(script).toContain("-L 127.0.0.1:9443:127.0.0.1:9443")
  })

  it("reuses a forward that already goes to the mini", () => {
    const world = createWorld({
      listening: [8443, 9443, 30039],
      macListeners: { "127.0.0.1:9443": "ssh -fN -L 127.0.0.1:9443:127.0.0.1:9443 mini" },
    })
    prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).not.toContain("-L 127.0.0.1:9443:127.0.0.1:9443 mini >")
  })

  it("leaves a foreign listener alone and says so", () => {
    const world = createWorld({
      listening: [8443, 9443, 30039],
      macListeners: { "127.0.0.1:9443": "node vite" },
    })
    expect(() => prepareForFeedback(world.deps, options)).toThrow(/9443.*node vite/)
  })

  it("uses a local VibeResults dev server instead of the mini's", () => {
    const world = createWorld({
      listening: [8443, 30039],
      macListeners: { "127.0.0.1:9443": LOCAL_DEV_SERVER },
    })
    const result = prepareForFeedback(world.deps, options)
    expect(world.miniScripts.join("\n")).not.toContain("'VibeResults dev'")
    expect(world.macScripts.join("\n")).not.toContain("-L 127.0.0.1:9443")
    expect(result).toMatchObject({
      vibeResults: "https://loura.devresultsnext.localhost:9443",
      vibeResultsSource: "mac",
      started: [],
    })
  })

  it("reports the mini as the VibeResults source when it forwards from there", () => {
    const world = createWorld({ listening: [8443, 9443, 30039] })
    expect(prepareForFeedback(world.deps, options).vibeResultsSource).toBe("mini")
  })

  it("reloads the Mac tunnel service when its loopback address is missing", () => {
    const world = createWorld({ listening: [8443, 9443, 30039], macAlias: false })
    prepareForFeedback(world.deps, options)
    expect(world.macScripts.join("\n")).toContain(
      "launchctl bootstrap system /Library/LaunchDaemons/com.herbcaudill.devlocal-mini-tunnel.plist",
    )
  })

  it("refuses an environment that does not exist", () => {
    const world = createWorld({ listening: [8443, 9443] })
    expect(() => prepareForFeedback(world.deps, { ...options, environment: "missing" })).toThrow(
      /missing/,
    )
  })

  it("reports how far the environment is behind its branch", () => {
    const world = createWorld({ listening: [8443, 9443, 30039] })
    expect(prepareForFeedback(world.deps, options).commitsBehind).toBe(1)
  })

  it("does not open browsers when asked not to", () => {
    const world = createWorld({ listening: [8443, 9443, 30039] })
    prepareForFeedback(world.deps, { ...options, open: false })
    expect(world.macScripts.join("\n")).not.toContain("Google Chrome")
  })
})

const LOCAL_DEV_SERVER =
  "node /Users/herbcaudill/Code/DevResults/devresults-next/apps/web/node_modules/.bin/../@react-router/dev/bin.js dev"

/** Fake the mini and Mac so sites come up when they are started. */
function createWorld({
  listening,
  macAlias = true,
  macListeners = {},
}: {
  listening: number[]
  macAlias?: boolean
  macListeners?: Record<string, string>
}) {
  const up = new Set(listening)
  const miniScripts: string[] = []
  const macScripts: string[] = []
  let alias = macAlias

  const mini = (script: string) => {
    miniScripts.push(script)
    if (script.includes("drenv.cmd") && script.includes(" status"))
      return `drenv request abc\n${JSON.stringify([
        {
          id: "compare-design-refresh",
          phase: "running",
          revision: "84c4abf",
          requestedRevision: "origin/codex/design-refresh",
          ports: { https: 30039 },
        },
      ])}`
    if (script.includes("drenv.cmd") && script.includes(" start ")) up.add(30039)
    if (script.includes("'VibeResults dev'")) up.add(9443)
    if (script.includes("'DevResults site'")) up.add(8443)
    if (script.includes("rev-list")) return "1"
    const port = script.match(/-LocalPort (\d+)/)?.[1]
    if (port) return up.has(Number(port)) ? "yes" : "no"
    return ""
  }

  const mac = (script: string) => {
    macScripts.push(script)
    if (script.includes("launchctl bootstrap")) alias = true
    if (script.includes("ifconfig lo0")) return alias ? "yes" : "no"
    const listener = script.match(/-iTCP@([\d.]+:\d+)/)?.[1]
    if (listener) return macListeners[listener] ?? ""
    if (script.includes("%{http_code}")) return "200"
    return ""
  }

  return { deps: { mini, mac, wait: () => {} }, miniScripts, macScripts }
}
