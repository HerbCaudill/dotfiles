/*
 * Serve a Jev dry run as a review page where Herb records the correct disposition for each thread.
 * Corrections are saved to corrections.json next to the dry-run file, keyed by Gmail message ID.
 * Nothing here touches Gmail.
 *
 * Usage: node --experimental-strip-types scripts/email-processing/serveJevReview.ts <dry-run.json> [--port 4319]
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { basename, dirname, join } from "node:path"

import {
  applyCorrectionUpdates,
  emptyCorrectionStore,
  type CorrectionStore,
  type CorrectionUpdate,
} from "./jevCorrections.ts"
import { renderHtmlReport } from "./renderJevDryRunHtml.ts"
import { redecide, type ClassifiedRecord, type DryRun } from "./renderJevDryRunReport.ts"

/** Load the run and serve the review page until stopped. */
function main() {
  const inputPath = process.argv[2]
  if (!inputPath) throw new Error("Pass the dry-run JSON file")
  const portIndex = process.argv.indexOf("--port")
  const port = portIndex === -1 ? DEFAULT_PORT : Number(process.argv[portIndex + 1])

  const run = redecide(JSON.parse(readFileSync(inputPath, "utf8")) as DryRun)
  const runName = basename(inputPath, ".json")
  const correctionsPath = join(dirname(inputPath), "corrections.json")
  const recordsById = new Map(
    run.records
      .filter((record): record is ClassifiedRecord => !("error" in record))
      .map(record => [record.messageId, record]),
  )

  const server = createServer((request, response) => {
    handle(request, response).catch(error => {
      console.error(error)
      send(response, 500, { error: String(error instanceof Error ? error.message : error) })
    })
  })

  /** Route one request. */
  async function handle(
    /** Incoming request. */
    request: IncomingMessage,
    /** Response to write. */
    response: ServerResponse,
  ) {
    const url = new URL(request.url ?? "/", "http://localhost")
    if (request.method === "GET" && url.pathname === "/") {
      const html = renderHtmlReport(run, { review: { corrections: readStore(correctionsPath) } })
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      response.end(html)
      return
    }
    if (request.method === "POST" && url.pathname === "/api/corrections") {
      if (!isSameOrigin(request)) return send(response, 403, { error: "Cross-origin request" })
      if (!request.headers["content-type"]?.startsWith("application/json"))
        return send(response, 415, { error: "Expected JSON" })
      const { updates } = JSON.parse(await readBody(request)) as { updates: CorrectionUpdate[] }
      const store = applyCorrectionUpdates(readStore(correctionsPath), updates, recordsById, {
        run: runName,
        now: new Date().toISOString(),
      })
      writeStore(correctionsPath, store)
      return send(response, 200, { ok: true, corrections: Object.keys(store.corrections).length })
    }
    send(response, 404, { error: "Not found" })
  }

  server.listen(port, "127.0.0.1", () => {
    console.log(`Reviewing ${inputPath}`)
    console.log(`Corrections: ${correctionsPath}`)
    console.log(`http://localhost:${port}/`)
  })
}

/** Read the corrections file, or an empty store before the first correction. */
function readStore(
  /** Corrections file. */
  path: string,
): CorrectionStore {
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as CorrectionStore)
    : emptyCorrectionStore()
}

/** Write the corrections file atomically so a crash never leaves it half-written. */
function writeStore(
  /** Corrections file. */
  path: string,
  /** Store to write. */
  store: CorrectionStore,
) {
  const temporaryPath = `${path}.tmp`
  writeFileSync(temporaryPath, `${JSON.stringify(store, null, 2)}\n`)
  renameSync(temporaryPath, path)
}

/** Reject writes from other pages: a browser always sends Origin on a cross-site POST. */
function isSameOrigin(
  /** Incoming request. */
  request: IncomingMessage,
) {
  const origin = request.headers.origin
  return !origin || new URL(origin).host === request.headers.host
}

/** Read a request body, up to a limit. */
async function readBody(
  /** Incoming request. */
  request: IncomingMessage,
) {
  let body = ""
  for await (const chunk of request) {
    body += chunk
    if (body.length > MAX_BODY_BYTES) throw new Error("Request body too large")
  }
  return body
}

/** Send a JSON response. */
function send(
  /** Response to write. */
  response: ServerResponse,
  /** HTTP status. */
  status: number,
  /** JSON body. */
  body: unknown,
) {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(body))
}

// CONSTANTS

const DEFAULT_PORT = 4319

const MAX_BODY_BYTES = 1_000_000

if (import.meta.main) main()
