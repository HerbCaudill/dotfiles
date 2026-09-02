import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

/** Load the canonical classifier prompt and derive its audit version from the content. */
export async function loadClassifierPolicy(): Promise<ClassifierPolicy> {
  const prompt = (await readFile(CLASSIFIER_PROMPT_PATH, "utf8")).trim()
  const digest = createHash("sha256").update(prompt, "utf8").digest("hex")
  return { prompt, version: `sha256:${digest}` }
}

const CLASSIFIER_PROMPT_PATH = new URL("./classifier.prompt.md", import.meta.url)

type ClassifierPolicy = {
  /** Complete source-controlled classifier instructions. */
  prompt: string
  /** Content-derived version recorded with classifier inputs and decisions. */
  version: string
}
