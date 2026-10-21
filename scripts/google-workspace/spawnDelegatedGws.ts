import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"

/** Invoke gws without a shell, keeping the delegated token out of arguments. */
export function spawnDelegatedGws(
  /** Literal CLI arguments, including JSON supplied by the caller. */
  arguments_: ReadonlyArray<string>,
  /** Fresh delegated access token supplied only to this child. */
  accessToken: string,
) {
  const command =
    process.env.GWS_COMMAND_PATH ??
    (process.platform === "win32"
      ? join(dirname(process.execPath), "node_modules", "@googleworkspace", "cli", "bin", "gws.exe")
      : "gws")
  const result = spawnSync(command, arguments_, {
    env: { ...process.env, GOOGLE_WORKSPACE_CLI_TOKEN: accessToken },
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  })
  return result.status ?? 1
}
