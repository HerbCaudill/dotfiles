/** Pin Portless to the managed HTTPS proxy, discarding any caller overrides. */
export function getPortlessEnv(
  /** User-owned shared Portless state. */
  stateDir: string,
) {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => key !== "PORTLESS" && !key.startsWith("PORTLESS_"),
      ),
    ),
    PORTLESS_STATE_DIR: stateDir,
    PORTLESS_PORT: "443",
    PORTLESS_HTTPS: "1",
    PORTLESS_LAN: "0",
    PORTLESS_SYNC_HOSTS: "0",
    PORTLESS_WILDCARD: "0",
    PORTLESS_TLD: "localhost",
  }
}
