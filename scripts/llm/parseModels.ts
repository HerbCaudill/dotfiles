import type { ArtificialAnalysisModel, Effort, Variant } from "./types.ts"

/** Turn Artificial Analysis models into the variants our harnesses can run. */
export function parseModels(
  /** Models from the API. */
  models: ArtificialAnalysisModel[],
  /** Find the harnesses and model IDs for a base slug. */
  getRunners: (baseSlug: string) => { harness: string; model: string }[],
): Variant[] {
  return models.flatMap(model => {
    const intelligence = model.evaluations?.artificial_analysis_intelligence_index
    const costPerTask = model.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost
    const effort = EFFORT_PATTERN.exec(model.name)?.[1]?.toLowerCase() as Effort | undefined
    if (intelligence == null || costPerTask == null || !effort) return []
    return getRunners(model.slug.replace(EFFORT_SUFFIX_PATTERN, "")).map(runner => ({
      costPerTask,
      effort,
      harness: runner.harness,
      intelligence,
      model: runner.model,
    }))
  })
}

const EFFORT_PATTERN = /\((low|medium|high|xhigh|max)\b/i
const EFFORT_SUFFIX_PATTERN = /-(low|medium|high|xhigh|max)$/
