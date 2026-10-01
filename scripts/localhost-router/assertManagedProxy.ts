import { readFile, access } from "node:fs/promises"
import { request } from "node:https"
import { join } from "node:path"

/** Require the managed HTTPS proxy rather than auto-starting a privileged process from an app. */
export async function assertManagedProxy(
  /** User-owned shared Portless state. */
  stateDir: string,
) {
  try {
    const [port, ca] = await Promise.all([
      readFile(join(stateDir, "proxy.port"), "utf8"),
      readFile(join(stateDir, "ca.pem")),
      access(join(stateDir, "proxy.tls")),
    ])
    if (port.trim() !== "443") throw new Error("Unexpected proxy port")
    await new Promise<void>((resolve, reject) => {
      const req = request(
        { hostname: "127.0.0.1", servername: "localhost", port: 443, ca, timeout: 2000 },
        response => {
          response.resume()
          if (response.headers["x-portless"] !== "1") reject(new Error("Unexpected listener"))
          else resolve()
        },
      )
      req.on("error", reject)
      req.on("timeout", () => req.destroy(new Error("Proxy check timed out")))
      req.end()
    })
  } catch {
    throw new Error(
      "The managed HTTPS localhost proxy is unavailable. Apply dotfiles with pnpm nix:rebuild; inspect com.herbcaudill.localhost-router and ~/.portless/service.log if it is already installed.",
    )
  }
}
