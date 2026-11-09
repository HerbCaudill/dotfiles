import type { Role } from "./types.ts"

/** Find a role by name. */
export function resolveRole(
  /** The model roles table. */
  roles: Role[],
  /** Role name. */
  name: string,
): Role {
  const role = roles.find(role => role.name === name)
  if (!role)
    throw new Error(`Unknown role: ${name}. Roles: ${roles.map(role => role.name).join(", ")}`)
  return role
}
