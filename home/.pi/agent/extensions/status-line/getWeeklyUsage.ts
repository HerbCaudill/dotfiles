import { execSync } from "node:child_process"

import { WEEKLY_USAGE_CACHE_MS } from "./constants.ts"
import type { WeeklyUsage, WeeklyUsageCache } from "./types.ts"

let cache: WeeklyUsageCache = { fetchedAt: 0, value: null }

/** Get weekly usage data from Anthropic's OAuth API, cached to avoid slow footer renders. */
export function getWeeklyUsage(): WeeklyUsage | null {
  const now = Date.now()

  if (now - cache.fetchedAt < WEEKLY_USAGE_CACHE_MS) {
    return cache.value
  }

  cache = { fetchedAt: now, value: fetchWeeklyUsage() }
  return cache.value
}

/** Fetch weekly usage data from the local Claude Code credentials. */
function fetchWeeklyUsage(): WeeklyUsage | null {
  try {
    const tokenJson = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      {
        encoding: "utf-8",
        timeout: 2000,
      },
    ).trim()

    const creds = JSON.parse(tokenJson) as { claudeAiOauth?: { accessToken?: string } }
    const accessToken = creds.claudeAiOauth?.accessToken
    if (!accessToken) return null

    const response = execSync(
      `curl -s --max-time 3 -H "Authorization: Bearer ${accessToken}" -H "anthropic-beta: oauth-2025-04-20" https://api.anthropic.com/api/oauth/usage`,
      { encoding: "utf-8", timeout: 4000 },
    )

    const usage = JSON.parse(response) as {
      seven_day?: { utilization?: number; resets_at?: string }
    }
    if (usage.seven_day?.utilization === undefined || !usage.seven_day.resets_at) return null

    return {
      utilization: usage.seven_day.utilization,
      resetsAt: usage.seven_day.resets_at,
    }
  } catch {
    return null
  }
}
