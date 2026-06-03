import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui"

import { formatNumber } from "./formatNumber.ts"
import { getContextPercentage } from "./getContextPercentage.ts"
import { getDirectoryName } from "./getDirectoryName.ts"
import { getTokenTotals } from "./getTokenTotals.ts"
import { getUsageRatioColor } from "./getUsageRatioColor.ts"
import { getWeeklyUsage } from "./getWeeklyUsage.ts"
import { getWeekProgress } from "./getWeekProgress.ts"
import { isGitDirty } from "./isGitDirty.ts"
import { renderProgressBar } from "./renderProgressBar.ts"

/** Install Herb's Claude-Code-style two-line footer for Pi. */
export default function statusLineExtension(
  /** The Pi extension API. */
  pi: ExtensionAPI,
) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setFooter((tui, theme, footerData) => {
      const branchUnsubscribe = footerData.onBranchChange(() => tui.requestRender())
      const interval = setInterval(() => tui.requestRender(), 60_000)

      return {
        dispose() {
          branchUnsubscribe()
          clearInterval(interval)
        },
        invalidate() {},
        render(width: number): string[] {
          const directory = theme.fg("accent", getDirectoryName(ctx.cwd))
          const branch = footerData.getGitBranch()
          const branchDisplay =
            branch ? theme.fg("success", `${branch}${isGitDirty(ctx.cwd) ? "*" : ""}`) : null
          const model = theme.fg("dim", ctx.model?.name ?? ctx.model?.id ?? "no model")
          const line1Parts = [directory, branchDisplay, model].filter(
            (part): part is string => !!part,
          )
          const line1 = truncateToWidth(line1Parts.join(" "), width)

          const line2Parts: string[] = []
          const contextPct = getContextPercentage(ctx.getContextUsage())

          if (contextPct !== null) {
            line2Parts.push(
              `${theme.fg("dim", "context")} ${renderProgressBar(
                contextPct,
                text => theme.fg("success", text),
                text => theme.fg("dim", text),
                text => theme.fg("dim", text),
              )}`,
            )
          }

          const totals = getTokenTotals(ctx.sessionManager.getBranch())
          if (totals.input > 0 || totals.output > 0) {
            line2Parts.push(
              theme.fg("dim", `${formatNumber(totals.input)}↓ ${formatNumber(totals.output)}↑`),
            )
          }

          const weeklyUsage = getWeeklyUsage()
          if (weeklyUsage) {
            const pct = Math.round(weeklyUsage.utilization)
            const weekProgress = getWeekProgress(weeklyUsage.resetsAt)
            const color = getUsageRatioColor(pct, weekProgress)
            line2Parts.push(
              `${theme.fg("dim", "weekly")} ${renderProgressBar(
                pct,
                text => theme.fg(color, text),
                text => theme.fg("dim", text),
                text => theme.fg("dim", text),
                weekProgress,
              )} ${theme.fg("dim", `(${weekProgress}% elapsed)`)}`,
            )
          }

          const line2 = truncateToWidth(line2Parts.join(` ${theme.fg("dim", "·")} `), width)

          return visibleWidth(line2) > 0 ? [line1, line2] : [line1]
        },
      }
    })
  })
}
