import { expect, test } from "vitest"
import { parseModels } from "../parseModels.ts"
import type { ArtificialAnalysisModel } from "../types.ts"

const canRun = (baseSlug: string) => {
  if (baseSlug === "gpt-6-1-sol") return [{ harness: "codex", model: "gpt-6.1-sol" }]
  if (baseSlug === "claude-opus-5-5") return [{ harness: "claude", model: "claude-opus-5-5" }]
  return []
}

test("turns scored models into a variant for each harness and effort", () => {
  expect(
    parseModels(
      [
        model("gpt-6-1-sol-xhigh", "GPT-6.1 Sol (Xhigh)", 52.3, 0.764),
        model("claude-opus-5-5", "Claude Opus 5.5 (Max, Default Fallback)", 58.4, 10.04),
      ],
      canRun,
    ),
  ).toEqual([
    {
      costPerTask: 0.764,
      effort: "xhigh",
      harness: "codex",
      intelligence: 52.3,
      model: "gpt-6.1-sol",
    },
    {
      costPerTask: 10.04,
      effort: "max",
      harness: "claude",
      intelligence: 58.4,
      model: "claude-opus-5-5",
    },
  ])
})

test("skips unscored, unrunnable and non-reasoning variants", () => {
  expect(
    parseModels(
      [
        model("gpt-6-1-sol-low", "GPT-6.1 Sol (Low)", null, null),
        model("glm-5-3", "GLM-5.3 (Max)", 31.7, 5),
        model("gpt-6-1-sol-non-reasoning", "GPT-6.1 Sol (Non-reasoning)", 30, 0.2),
      ],
      canRun,
    ),
  ).toEqual([])
})

/** Create a model as the API returns it. */
function model(
  /** API slug. */
  slug: string,
  /** Display name. */
  name: string,
  /** Intelligence score. */
  intelligence: number | null,
  /** Cost per task. */
  costPerTask: number | null,
): ArtificialAnalysisModel {
  return {
    artificial_analysis_intelligence_index_cost: { cost_per_task: { total_cost: costPerTask } },
    evaluations: { artificial_analysis_intelligence_index: intelligence },
    name,
    slug,
  }
}
