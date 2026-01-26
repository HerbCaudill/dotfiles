#!/usr/bin/env node

const { execSync } = require('child_process')
const { readFileSync } = require('fs')

// ANSI color codes
const BLACK = '\x1b[30m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'
const ORANGE = '\x1b[38;5;208m'
const DARK_YELLOW = '\x1b[38;5;178m'
const CORAL = '\x1b[38;2;230;113;78m' // #E6714E
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const NORMAL = '\x1b[22m'

function getGitBranch(cwd) {
  try {
    execSync(`git -c core.fileMode=false config --global --add safe.directory "${cwd}"`, {
      cwd,
      stdio: 'ignore',
    })

    const branch = execSync('git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD', {
      cwd,
      encoding: 'utf-8',
    }).trim()

    return branch || null
  } catch {
    return null
  }
}

function isGitDirty(cwd) {
  try {
    const status = execSync('git -c core.fileMode=false status --porcelain', {
      cwd,
      encoding: 'utf-8',
    }).trim()

    return status.length > 0
  } catch {
    return false
  }
}

function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function getActiveSkill(transcriptPath) {
  if (!transcriptPath) return null
  try {
    const lines = readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean)
    let lastSkill = null
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        // Check for user-invoked skills via <command-name> tag
        if (entry.type === 'user' && typeof entry.message?.content === 'string') {
          const match = entry.message.content.match(/<command-name>\/([^<]+)<\/command-name>/)
          if (match) {
            lastSkill = match[1]
          }
        }
        // Also check for Skill tool uses (when assistant invokes skills)
        const content = entry.message?.content
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'tool_use' && item.name === 'Skill' && item.input?.skill) {
              lastSkill = item.input.skill
            }
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
    return lastSkill
  } catch {
    return null
  }
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

function visibleLength(str) {
  return stripAnsi(str).length
}

/**
 * Get weekly usage data from Anthropic's OAuth API.
 * Returns { utilization, resetsAt } or null if unable to fetch.
 */
function getWeeklyUsage() {
  try {
    const tokenJson = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: 'utf-8' }
    ).trim()

    const creds = JSON.parse(tokenJson)
    const accessToken = creds.claudeAiOauth?.accessToken
    if (!accessToken) return null

    const response = execSync(
      `curl -s -H "Authorization: Bearer ${accessToken}" -H "anthropic-beta: oauth-2025-04-20" https://api.anthropic.com/api/oauth/usage`,
      { encoding: 'utf-8', timeout: 2000 }
    )

    const usage = JSON.parse(response)
    if (!usage.seven_day) return null

    return {
      utilization: usage.seven_day.utilization,
      resetsAt: usage.seven_day.resets_at,
    }
  } catch {
    return null
  }
}

/**
 * Calculate percentage through the weekly usage period.
 * Uses the resets_at timestamp from the API to determine the 7-day window.
 */
function getWeekProgress(resetsAt) {
  const now = Date.now()
  const resetTime = new Date(resetsAt).getTime()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const startTime = resetTime - weekMs

  const elapsed = now - startTime
  const progress = (elapsed / weekMs) * 100

  return Math.max(0, Math.min(100, Math.round(progress)))
}

/**
 * Render a progress bar with customizable color.
 * Uses ▰ for filled and ▱ for empty segments.
 *
 * percentage - The percentage to display (0-100)
 * color - ANSI color code for the filled segments
 * timeMarkerPosition - Optional position (0-100) to show a combining caron marker
 */
function renderProgressBar(percentage, color, timeMarkerPosition = null) {
  const width = 10
  const filled = Math.round((percentage / 100) * width)
  const timePos = timeMarkerPosition !== null ? Math.round((timeMarkerPosition / 100) * width) : null

  let bar = ''
  for (let i = 0; i < width; i++) {
    const isFilled = i < filled
    const char = isFilled ? '▰' : '▱'
    const colorCode = isFilled ? color : DIM

    if (timePos !== null && i === timePos && timePos < width) {
      // Add combining caron (U+030C) to mark time position
      bar += `${colorCode}${char}\u030C${RESET}`
    } else {
      bar += `${colorCode}${char}${RESET}`
    }
  }

  return `${bar} ${DIM}${percentage}%${RESET}`
}

/**
 * Get color for usage percentage.
 * Green (<50%), yellow (50-80%), red (>80%)
 */
function getUsageColor(percentage) {
  if (percentage >= 80) return RED
  if (percentage >= 50) return YELLOW
  return GREEN
}


function main() {
  // Read JSON input from stdin
  const input = readFileSync(0, 'utf-8')
  const data = JSON.parse(input)


  // LEFT SIDE: directory and branch
  const leftParts = []

  const cwd = data.workspace.current_dir
  const dir = cwd.split('/').pop() || cwd
  leftParts.push(`${CYAN}${dir}${RESET}`)

  const branch = getGitBranch(cwd)
  if (branch) {
    const dirty = isGitDirty(cwd)
    const branchDisplay = dirty ? `${branch}*` : branch
    leftParts.push(`${GREEN}${branchDisplay}${RESET}`)
  }

  const skill = getActiveSkill(data.transcript_path)
  if (skill) {
    leftParts.push(`${BLACK}${BOLD}/${skill}${RESET}`)
  }

  // RIGHT SIDE of line 1: model
  leftParts.push(`${NORMAL}${DIM}${data.model.display_name}${RESET}`)

  // LINE 2: progress bars and token counts
  const line2Parts = []

  if (data.context_window.current_usage) {
    const usage = data.context_window.current_usage
    const currentTokens =
      usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
    const contextSize = data.context_window.context_window_size
    const percentage = Math.round((currentTokens / contextSize) * 100)
    line2Parts.push(`${DIM}context${RESET} ${renderProgressBar(percentage, GREEN)}`)
  }

  const totalIn = data.context_window.total_input_tokens
  const totalOut = data.context_window.total_output_tokens
  if (totalIn > 0 || totalOut > 0) {
    line2Parts.push(`${DIM}${formatNumber(totalIn)}↓ ${formatNumber(totalOut)}↑${RESET}`)
  }

  const weeklyUsage = getWeeklyUsage()
  if (weeklyUsage !== null) {
    const pct = Math.round(weeklyUsage.utilization)
    const weekProgress = getWeekProgress(weeklyUsage.resetsAt)
    line2Parts.push(`${DIM}weekly${RESET} ${renderProgressBar(pct, CORAL, weekProgress)}`)
  }

  // Output: line 1 (dir, branch, skill, model) + line 2 (progress bars, tokens)
  const line1 = leftParts.join(' ')
  const line2 = line2Parts.join(' · ')

  process.stdout.write(`${line1}\n${line2}`)
}

main()
