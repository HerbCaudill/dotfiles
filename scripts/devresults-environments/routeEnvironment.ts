import { spawn, type ChildProcess } from "node:child_process"
import { createConnection, createServer } from "node:net"
import { homedir } from "node:os"
import { join } from "node:path"
import { assertManagedProxy } from "../localhost-router/assertManagedProxy.ts"
import { getPortlessEnv } from "../localhost-router/getPortlessEnv.ts"
import { getRouteSettings } from "./getRouteSettings.ts"

/** Serve an environment's legacy site at named .localhost origins; resolves once interrupted and stopped. */
export async function routeEnvironment(
  /** Target host, legacy URL and naming options. */
  options: {
    /** SSH host running the environment. */
    host: string
    /** Stable environment identity. */
    id: string
    /** Legacy origin reported by `drenv url`. */
    legacyUrl: string
    /** Hostname label shared by every routed instance. */
    name?: string
    /** Instance subdomains to route. */
    instances?: string[]
  },
) {
  const stateDir = join(homedir(), ".portless")
  await assertManagedProxy(stateDir)
  const settings = getRouteSettings(options)
  const tunnelPort = await getFreePort()
  const children: ChildProcess[] = []
  let stopping = false
  /** Stop every child so no route outlives its tunnel. */
  const stop = (
    /** Exit code once children have been signalled. */
    code: number,
  ) => {
    if (stopping) return
    stopping = true
    for (const child of children) child.kill("SIGTERM")
    process.exitCode = code
  }
  /** Track a child whose unexpected exit ends the whole route. */
  const supervise = (
    /** Spawned tunnel or Portless process. */
    child: ChildProcess,
    /** Description used when it exits unexpectedly. */
    label: string,
  ) => {
    children.push(child)
    child.on("exit", code => {
      if (stopping) return
      console.error(`${label} exited with code ${code}`)
      stop(1)
    })
    return child
  }
  process.on("SIGINT", () => stop(0))
  process.on("SIGTERM", () => stop(0))

  supervise(
    spawn(
      "ssh",
      [
        "-N",
        "-o",
        "ExitOnForwardFailure=yes",
        "-o",
        "ServerAliveInterval=30",
        "-L",
        `127.0.0.1:${tunnelPort}:127.0.0.1:${settings.upstreamPort}`,
        options.host,
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    ),
    "SSH tunnel",
  )
  try {
    await waitForPort(tunnelPort)
  } catch (error) {
    stop(1)
    throw error
  }
  const bridge = join(import.meta.dirname, "routeBridge.ts")
  for (const name of settings.names) {
    supervise(
      spawn(
        "portless",
        [
          "--name",
          name,
          process.execPath,
          "--experimental-strip-types",
          bridge,
          String(tunnelPort),
          settings.servername,
        ],
        { env: getPortlessEnv(stateDir), stdio: ["ignore", "ignore", "inherit"] },
      ),
      `Route ${name}`,
    )
    console.log(`https://${name}.localhost -> ${options.id}`)
  }
  await Promise.all(
    children.map(
      child =>
        new Promise(resolve =>
          child.exitCode !== null ? resolve(null) : child.on("exit", resolve),
        ),
    ),
  )
}

/** Reserve an unused loopback port for the private SSH forward. */
function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
  })
}

/** Wait until the SSH forward accepts connections. */
async function waitForPort(
  /** Local forward port. */
  port: number,
) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const open = await new Promise<boolean>(resolve => {
      const socket = createConnection({ host: "127.0.0.1", port })
      socket.on("connect", () => {
        socket.destroy()
        resolve(true)
      })
      socket.on("error", () => resolve(false))
    })
    if (open) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`The SSH forward on port ${port} did not open`)
}
