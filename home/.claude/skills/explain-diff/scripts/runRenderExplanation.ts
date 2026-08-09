import { readFileSync } from "node:fs"
import path from "node:path"
import { renderExplanation } from "./renderExplanation.ts"
import type { ExplanationInput } from "./types.ts"

/** Read a structured explanation file and render it to the requested HTML path. */
export async function runRenderExplanation(arguments_: string[]): Promise<void> {
  const [inputArgument, outputArgument] = arguments_
  if (!inputArgument || !outputArgument) {
    throw new Error("Usage: node runRenderExplanation.ts <input.json> <output.html>")
  }

  const inputPath = path.resolve(inputArgument)
  const outputPath = path.resolve(outputArgument)
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as ExplanationInput
  const result = await renderExplanation(input, outputPath)
  process.stdout.write(`${result.outputPath}\n${result.diffPath}\n`)
}

runRenderExplanation(process.argv.slice(2)).catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
