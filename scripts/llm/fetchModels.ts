import type { ArtificialAnalysisModel } from "./types.ts"

/** Fetch every page of the Artificial Analysis free model list. */
export async function fetchModels(
  /** Artificial Analysis API key. */
  apiKey: string,
): Promise<FetchModelsResult> {
  const models: ArtificialAnalysisModel[] = []
  for (let page = 1; ; page++) {
    const response = await fetch(`${MODELS_URL}?page=${page}`, {
      headers: { "x-api-key": apiKey },
    })
    if (!response.ok) throw new Error(`Artificial Analysis returned ${response.status}`)
    const body = (await response.json()) as ModelsResponse
    models.push(...body.data)
    if (!body.pagination.has_more) return { indexVersion: body.intelligence_index_version, models }
  }
}

const MODELS_URL = "https://artificialanalysis.ai/api/v2/language/models/free"

export type FetchModelsResult = {
  /** Index version the scores belong to. */
  indexVersion: number
  /** All models from all pages. */
  models: ArtificialAnalysisModel[]
}

type ModelsResponse = {
  /** Models on this page. */
  data: ArtificialAnalysisModel[]
  /** Index version the scores belong to. */
  intelligence_index_version: number
  /** Paging details. */
  pagination: {
    /** Whether another page follows. */
    has_more: boolean
  }
}
