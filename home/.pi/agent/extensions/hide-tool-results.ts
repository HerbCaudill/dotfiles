import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import {
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
  keyHint,
} from "@mariozechner/pi-coding-agent"
import { Text } from "@mariozechner/pi-tui"
import { homedir } from "node:os"

import { getVisibleToolResultText } from "./tool-results/getVisibleToolResultText.ts"

/** Replace the home directory prefix with a tilde. */
function shortenPath(
  /** The absolute path to shorten. */
  path: string,
): string {
  const homeDirectory = homedir()

  if (path.startsWith(homeDirectory)) {
    return `~${path.slice(homeDirectory.length)}`
  }

  return path
}

/** Create the built-in tools for a specific working directory. */
function createBuiltInTools(
  /** The working directory the tools should operate in. */
  cwd: string,
) {
  return {
    read: createReadTool(cwd),
    bash: createBashTool(cwd),
    edit: createEditTool(cwd),
    write: createWriteTool(cwd),
  }
}

const toolCache = new Map<string, ReturnType<typeof createBuiltInTools>>()

/** Reuse built-in tool instances per working directory. */
function getBuiltInTools(
  /** The working directory the tools should operate in. */
  cwd: string,
) {
  const cachedTools = toolCache.get(cwd)

  if (cachedTools) {
    return cachedTools
  }

  const tools = createBuiltInTools(cwd)
  toolCache.set(cwd, tools)
  return tools
}

/** Hide built-in tool results by default while keeping ctrl+o expansion. */
export default function hideToolResultsExtension(
  /** The pi extension API. */
  pi: ExtensionAPI,
) {
  pi.registerTool({
    name: "read",
    label: "read",
    description: getBuiltInTools(process.cwd()).read.description,
    parameters: getBuiltInTools(process.cwd()).read.parameters,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate)
    },

    renderCall(args, theme, context) {
      const pathDisplay = args.path
        ? theme.fg("accent", shortenPath(args.path))
        : theme.fg("toolOutput", "...")
      const lineRange =
        args.offset !== undefined || args.limit !== undefined
          ? theme.fg(
              "warning",
              `:${args.offset ?? 1}${args.limit !== undefined ? `-${(args.offset ?? 1) + args.limit - 1}` : ""}`,
            )
          : ""
      const expandHint = context.expanded
        ? ""
        : theme.fg("muted", ` (${keyHint("app.tools.expand", "to show result")})`)

      return new Text(
        `${theme.fg("toolTitle", theme.bold("read"))} ${pathDisplay}${lineRange}${expandHint}`,
        0,
        0,
      )
    },

    renderResult(result, options, theme) {
      const visibleText = getVisibleToolResultText(result, { expanded: options.expanded })

      if (!visibleText) {
        return new Text("", 0, 0)
      }

      const lines = visibleText.slice(1).split("\n")
      const output = lines.map(line => theme.fg("toolOutput", line)).join("\n")
      return new Text(`\n${output}`, 0, 0)
    },
  })

  pi.registerTool({
    name: "bash",
    label: "bash",
    description: getBuiltInTools(process.cwd()).bash.description,
    parameters: getBuiltInTools(process.cwd()).bash.parameters,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).bash.execute(toolCallId, params, signal, onUpdate)
    },

    renderCall(args, theme, context) {
      const timeoutSuffix = args.timeout ? theme.fg("muted", ` (timeout ${args.timeout}s)`) : ""
      const expandHint = context.expanded
        ? ""
        : theme.fg("muted", ` (${keyHint("app.tools.expand", "to show result")})`)

      return new Text(
        `${theme.fg("toolTitle", theme.bold(`$ ${args.command || "..."}`))}${timeoutSuffix}${expandHint}`,
        0,
        0,
      )
    },

    renderResult(result, options, theme) {
      const visibleText = getVisibleToolResultText(result, {
        expanded: options.expanded,
        trim: true,
      })

      if (!visibleText) {
        return new Text("", 0, 0)
      }

      const lines = visibleText.slice(1).split("\n")
      const output = lines.map(line => theme.fg("toolOutput", line)).join("\n")
      return new Text(`\n${output}`, 0, 0)
    },
  })

  pi.registerTool({
    name: "edit",
    label: "edit",
    description: getBuiltInTools(process.cwd()).edit.description,
    parameters: getBuiltInTools(process.cwd()).edit.parameters,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate)
    },

    renderCall(args, theme, context) {
      const pathDisplay = args.path
        ? theme.fg("accent", shortenPath(args.path))
        : theme.fg("toolOutput", "...")
      const expandHint = context.expanded
        ? ""
        : theme.fg("muted", ` (${keyHint("app.tools.expand", "to show result")})`)

      return new Text(
        `${theme.fg("toolTitle", theme.bold("edit"))} ${pathDisplay}${expandHint}`,
        0,
        0,
      )
    },

    renderResult(result, options, theme) {
      const visibleText = getVisibleToolResultText(result, { expanded: options.expanded })

      if (!visibleText) {
        return new Text("", 0, 0)
      }

      const lines = visibleText.slice(1).split("\n")
      const output = lines.map(line => theme.fg("toolOutput", line)).join("\n")
      return new Text(`\n${output}`, 0, 0)
    },
  })

  pi.registerTool({
    name: "write",
    label: "write",
    description: getBuiltInTools(process.cwd()).write.description,
    parameters: getBuiltInTools(process.cwd()).write.parameters,

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate)
    },

    renderCall(args, theme, context) {
      const pathDisplay = args.path
        ? theme.fg("accent", shortenPath(args.path))
        : theme.fg("toolOutput", "...")
      const lineCount = args.content
        ? theme.fg("muted", ` (${args.content.split("\n").length} lines)`)
        : ""
      const expandHint = context.expanded
        ? ""
        : theme.fg("muted", ` (${keyHint("app.tools.expand", "to show result")})`)

      return new Text(
        `${theme.fg("toolTitle", theme.bold("write"))} ${pathDisplay}${lineCount}${expandHint}`,
        0,
        0,
      )
    },

    renderResult(result, options, theme) {
      const visibleText = getVisibleToolResultText(result, { expanded: options.expanded })

      if (!visibleText) {
        return new Text("", 0, 0)
      }

      const lines = visibleText.slice(1).split("\n")
      const output = lines.map(line => theme.fg("toolOutput", line)).join("\n")
      return new Text(`\n${output}`, 0, 0)
    },
  })
}
