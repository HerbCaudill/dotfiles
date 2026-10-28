# Agent access to DXOS project data

Verified on Herb’s Mac on 2026-10-28. The hosted server is `https://mcp.dxos.network/mcp`. Codex has a global Streamable HTTP server named `dxos` with OAuth credentials managed by Codex. This works across repositories. A fresh Codex process successfully read schema metadata in Tasks and queried an existing object in DevResults through the same connection.

## Connection

Use the directly available DXOS MCP tools. In Codex their names are `mcp__dxos__whoami`, `mcp__dxos__queryOperations`, `mcp__dxos__loadSkill`, and `mcp__dxos__invokeOperation`. The claude.ai DXOS connector exposes the same surface with the prefix `mcp__claude_ai_DXOS__`. A server added after an agent session starts may require a fresh session before its tools appear.

To inspect setup, use `codex mcp get dxos --json` or `codex mcp list`. The global server was added with `codex mcp add dxos --url https://mcp.dxos.network/mcp`. If authentication expires, use `codex mcp login dxos`. OAuth credentials belong in Codex’s credential store; never copy them into project files, prompts, logs, or this skill.

`invokeOperation` is a generic dispatch tool. A read operation inside it can still trigger the client’s tool-approval policy. In noninteractive Codex with approval policy `never`, this produces `MCP tool call requires approval, but approval policy is never`. A sandbox setting does not authorize MCP operations. Use the session’s supported approval process; preserve the global tool-approval settings. The connection canaries used a temporary invocation-specific approval setting after constraining their prompts to named read operations. That setting was not persisted globally.

## Select the project explicitly

Call `whoami` before accessing project data. Herb’s expected identity is `did:halo:BO5X6WF2MI3KBVYDKR4334D2SCEAAC5HV`. Confirm the requested space is listed, and pass its exact ID on every operation. Space names are not unique.

| Project                        | Space ID                            | Local schema source                                                        |
| ------------------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| Personal Tasks                 | `B7CSO2L6KYNN4HZBSBNHP3LC3SA7PYNJO` | `~/Code/HerbCaudill/tasks/src/schema/taskTypes.ts` and `src/board/schema/` |
| DevResults / X3                | `BJDYNXBBLNRQUZHERYKOYTVNVHVMMCED7` | `~/Code/DevResults/x3/src/schema/x3Types.ts` and its imported schema files |
| Disposable function experiment | `BQX5SFAOJTHV236E5VQLJM5YHE4VQTFYA` | Scratch metadata only; no application data                                 |

For other projects, resolve the space and schema source from that project’s instructions. Preserve the selected ID rather than adopting a same-named space. The September meeting notes say Rich used MCP from Claude to query Composer tasks and documents; they do not identify his endpoint or deployment configuration.

## Read project data

Load the `database` skill and retain its returned `skillToken` for operation calls. Inspect the full operation schemas with `queryOperations` before constructing requests. Do not treat an empty text search as proof that an operation is absent; exact key lookup is available.

The verified read keys are `org.dxos.operation.space.queryTypes`, `org.dxos.operation.space.queryObjects`, and `org.dxos.operation.space.getObjects`. All report `hints.mutation: none`. `queryObjects` returns references and typenames; `getObjects` fetches their contents. Keep queries bounded and request only the contents needed for the user’s task. Querying custom objects works even when their schema does not appear in `queryTypes`.

For custom schema guidance, inspect the project’s versioned source types. A `dxn:<typename>:<version>` identifies a type; an `echo://<space-id>/<object-id>` reference identifies a stored object. Tasks types use `com.herbcaudill.tasks.*`; X3 types use `com.devresults.type.*`. App field names and meanings must come from those definitions and the project’s documented operations.

## Publishing and discovery

`client.addTypes(types)` registers definitions in that running client. `db.addType(type)` persists a definition in the selected space. Tasks and X3 now publish their registered schemas on normal space opening; their code changes are in their own repositories.

Hosted custom schema discovery remains unreliable: `addType` successfully returned a custom schema record, and a later fresh session read the same record by ECHO reference, but `queryTypes` still omitted its typename. Fresh direct Codex OAuth reproduced this, so reconnecting the older Claude connector alone is insufficient. A stored schema’s raw `jsonSchema` is also more faithful than a JSON-to-Effect-to-JSON conversion, which was observed dropping `minLength` constraints.

The function experiment is now decisive for the tested server configuration. An EDGE-deployed echo, opted-in Skill, and linked instruction Text are all readable in the scratch space through hosted MCP. Nevertheless, exact `queryOperations` lookup returns no probe operation and `loadSkill("mcpProbe")` reports an unknown skill. Deploying a function and storing a Skill did not automatically register them in the hosted MCP surface. The supported server-side registration or plugin-installation path still needs confirmation from DXOS.

## Writes and application rules

Use each app’s documented domain operations for actions that depend on its rules. Generic field updates do not demonstrate guarded description saves, ordering, idempotent capture, or concurrency behavior. Personal Tasks actions use the `tasks` skill and managed CLI until the user authorizes a verified replacement. Publishing schemas did not migrate those rules or retire the peer.

For X3, inspect `src/data/operations/` and the installed app operation contributions before changing company data. Follow the project’s approval requirements. An empty hosted schema lookup does not authorize guessing a write payload. A write with a lost or ambiguous response requires read-back before any retry.

The claude.ai DXOS connector’s write tools are set to Always allow. That setting was left unchanged. The direct Codex server retains the client’s normal approval policy.

The full experiment, artifacts, IDs, and validation record live in `~/Code/HerbCaudill/tasks/docs/dxos-mcp-function-probe.md`. Keep test devices, profiles, spaces and deployments until Herb approves their removal.
