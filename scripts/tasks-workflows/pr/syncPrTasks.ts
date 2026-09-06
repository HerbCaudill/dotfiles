import { getPendingPullRequestTasks } from "../../github-pr-tasks/getPendingPullRequestTasks.ts"
import { createPrIntent } from "./createPrIntent.ts"
import type { PrSyncDependencies } from "./types.ts"

/** Process a complete notification batch without advancing past an unfinished event. */
export async function syncPrTasks(
  /** Private state and the reviewed Tasks CLI operation boundary. */
  dependencies: PrSyncDependencies,
) {
  let state = await dependencies.loadState()
  const startedAt = dependencies.now()
  const notifications = await dependencies.listNotifications(state.lastCheckedAt)
  const pending = new Map(
    Object.values(state.intents)
      .filter(intent => !state.processedEventKeys.includes(intent.eventKey))
      .map(intent => [intent.eventKey, intent]),
  )
  for (const event of getPendingPullRequestTasks(notifications, state.processedEventKeys))
    if (!pending.has(event.eventKey))
      pending.set(event.eventKey, createPrIntent(event.eventKey, event.task))
  let processedCount = 0
  for (const original of pending.values()) {
    state = { ...state, intents: { ...state.intents, [original.eventKey]: original } }
    await dependencies.saveState(state)
    const completed = await dependencies.completeEvent(original, async progress => {
      state = { ...state, intents: { ...state.intents, [original.eventKey]: progress } }
      await dependencies.saveState(state)
    })
    if (
      completed.phase !== "saved" ||
      completed.eventKey !== original.eventKey ||
      !completed.taskId
    )
      throw new Error("Tasks event did not reach a confirmed result")
    state = {
      ...state,
      intents: { ...state.intents, [original.eventKey]: completed },
      processedEventKeys: [...state.processedEventKeys, original.eventKey],
    }
    await dependencies.saveState(state)
    processedCount++
  }
  await dependencies.saveState({ ...state, lastCheckedAt: startedAt })
  return { checkedCount: notifications.length, processedCount }
}
