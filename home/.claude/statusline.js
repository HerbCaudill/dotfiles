#!/usr/bin/env node

const { execSync } = require('child_process')
const { readFileSync } = require('fs')

// ANSI color codes
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

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
    leftParts.push(`${MAGENTA}/${skill}${RESET}`)
  }

  // RIGHT SIDE: model, context, tokens (all gray)
  const rightParts = []

  rightParts.push(data.model.display_name)

  if (data.context_window.current_usage) {
    const usage = data.context_window.current_usage
    const currentTokens =
      usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
    const contextSize = data.context_window.context_window_size
    const percentage = Math.round((currentTokens / contextSize) * 100)
    rightParts.push(`${percentage}%`)
  }

  const totalIn = data.context_window.total_input_tokens
  const totalOut = data.context_window.total_output_tokens
  if (totalIn > 0 || totalOut > 0) {
    rightParts.push(`${formatNumber(totalIn)}↓ ${formatNumber(totalOut)}↑`)
  }

  // Output: left (colored) ... right (gray, right-aligned)
  const left = leftParts.join(' ')
  const right = `${DIM}${rightParts.join(' · ')}${RESET}`

  process.stdout.write(`${left} ${right}`)
}

main()
