import { resolveDevNames } from "./resolveDevNames.ts"

/** Resolve the public development address and preserve command arguments without a shell. */
export function getLaunchSettings(
  /** Working checkout. */
  cwd: string,
  /** CLI command arguments, optionally preceded by a service label. */
  args: string[],
) {
  const names = resolveDevNames(cwd)
  const service = args[0] === "--service" ? args[1] : undefined
  if (
    args[0] === "--service" &&
    (!service || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(service))
  )
    throw new Error("The service must be a lowercase DNS label of 1–63 characters.")
  const command = service ? args.slice(2) : args
  if (command.length === 0)
    throw new Error("Provide a command, for example: localhost-dev pnpm dev:app")
  const name = service
    ? `${names.worktreeName ? `${names.worktreeName}.` : ""}${service}.${names.repoName}`
    : names.webName
  return { name, url: `https://${name}.localhost`, command }
}
