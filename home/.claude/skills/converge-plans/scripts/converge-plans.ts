#!/usr/bin/env node

import { runConvergePlans } from "./runConvergePlans.ts"

try {
  const result = runConvergePlans(process.argv.slice(2), { cwd: process.cwd() })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
}
