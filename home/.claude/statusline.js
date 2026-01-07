#!/usr/bin/env npx tsx

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// ANSI color codes
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

interface StatusLineInput {
  session_id: string
  transcript_path: string
  cwd: string
  model: {
    id: string
    display_name: string
  }
  workspace: {
    current_dir: string
    project_dir: string
  }
  version: string
  output_style: {
    name: string
  }
  context_window: {
    total_input_tokens: number
    total_output_tokens: number
    context_window_size: number
    current_usage: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens: number
      cache_read_input_tokens: number
    } | null
  }
}

function getGitBranch(cwd: string): string | null {
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

function isGitDirty(cwd: string): boolean {
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

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

function visibleLength(str: string): number {
  return stripAnsi(str).length
}

function main() {
  // Read JSON input from stdin
  const input = readFileSync(0, 'utf-8')
  const data: StatusLineInput = JSON.parse(input)

  // LEFT SIDE: directory and branch
  const leftParts: string[] = []

  const cwd = data.workspace.current_dir
  const dir = cwd.split('/').pop() || cwd
  leftParts.push(`${CYAN}${dir}${RESET}`)

  const branch = getGitBranch(cwd)
  if (branch) {
    const dirty = isGitDirty(cwd)
    const branchDisplay = dirty ? `${branch}*` : branch
    leftParts.push(`${GREEN}${branchDisplay}${RESET}`)
  }

  // RIGHT SIDE: model, context, tokens (all gray)
  const rightParts: string[] = []

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

  const termWidth = process.stdout.columns || 80
  const leftLen = visibleLength(left)
  const rightLen = visibleLength(right)
  const padding = Math.max(1, termWidth - leftLen - rightLen)

  process.stdout.write(`${left}${' '.repeat(padding)}${right}`)
}

main()
