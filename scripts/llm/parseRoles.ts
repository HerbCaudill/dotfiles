import { HARNESSES } from "./harnesses.ts"
import type { Effort, Role } from "./types.ts"

/** Read the model roles table from the global agent instructions. */
export function parseRoles(
  /** Markdown of the instructions file. */
  markdown: string,
): Role[] {
  const section = markdown.split(/^## Model roles\s*$/m)[1]?.split(/^## /m)[0]
  if (section === undefined) throw new Error("No ## Model roles section in the instructions")

  const rows = section
    .split("\n")
    .filter(line => line.trim().startsWith("|"))
    .map(line =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map(cell => cell.trim().replaceAll("`", "")),
    )
  const [header, , ...body] = rows
  if (!header) throw new Error("No table in the ## Model roles section")
  const column = (name: string) => {
    const index = header.indexOf(name)
    if (index === -1) throw new Error(`The model roles table has no ${name} column`)
    return index
  }
  const [role, harness, model, effort] = ["Role", "Harness", "Model", "Effort"].map(column)

  return body.map(cells => ({
    effort: readEffort(cells[effort!]!),
    harness: readHarness(cells[harness!]!),
    model: cells[model!]!,
    name: cells[role!]!,
  }))
}

/** Map a harness title from the table to its adapter name. */
function readHarness(
  /** Table cell. */
  title: string,
): string {
  const harness = Object.values(HARNESSES).find(harness => harness.title === title)
  if (!harness) throw new Error(`llm can't run the ${title} harness`)
  return harness.name
}

/** Check an effort cell. */
function readEffort(
  /** Table cell. */
  effort: string,
): Effort {
  if (!EFFORTS.includes(effort as Effort)) throw new Error(`Unknown effort: ${effort}`)
  return effort as Effort
}

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"]
