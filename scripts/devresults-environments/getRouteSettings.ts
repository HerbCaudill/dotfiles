/** Derive the Portless names and HTTPS upstream for an environment's legacy site. */
export function getRouteSettings(
  /** Environment identity, its reported legacy URL and optional naming overrides. */
  options: {
    /** Stable environment identity. */
    id: string
    /** Legacy origin reported by `drenv url`. */
    legacyUrl: string
    /** Hostname label shared by every routed instance. */
    name?: string
    /** Instance subdomains to route; defaults to the legacy URL's instance. */
    instances?: string[]
  },
) {
  const url = new URL(options.legacyUrl)
  const [defaultInstance] = url.hostname.split(".")
  const label = options.name ?? `devresults-${options.id}`
  const instances = options.instances?.length ? options.instances : [defaultInstance]
  for (const value of [label, ...instances])
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value))
      throw new Error(`Invalid hostname label: ${value}`)
  return {
    upstreamPort: Number(url.port),
    // The legacy certificate covers *.devlocal.us; IIS matches requests by port, not host.
    servername: url.hostname,
    names: instances.map(instance => `${instance}.${label}`),
  }
}
