#!/usr/bin/env npx tsx

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// ANSI color codes
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'

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
    // Add safe directory and get branch name
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

function main() {
  // Read JSON input from stdin
  const input = readFileSync(0, 'utf-8')
  const data: StatusLineInput = JSON.parse(input)

  // Extract current working directory
  const cwd = data.workspace.current_dir
  const dir = cwd.split('/').pop() || cwd

  // Get git branch
  const branch = getGitBranch(cwd)

  // Build status line
  if (branch) {
    const dirty = isGitDirty(cwd)
    const branchDisplay = dirty ? `${branch}*` : branch
    process.stdout.write(`${CYAN}${dir}${RESET} ${GREEN}${branchDisplay}${RESET}`)
  } else {
    process.stdout.write(`${CYAN}${dir}${RESET}`)
  }
}

main()
