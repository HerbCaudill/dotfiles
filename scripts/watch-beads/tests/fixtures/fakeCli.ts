import { appendFileSync, readFileSync, watchFile } from "node:fs"
import { basename } from "node:path"

const executable = basename(process.argv[1])
const args = process.argv.slice(2)
const fixture = process.env.WATCH_BEADS_FIXTURE!
const board = () => JSON.parse(readFileSync(fixture, "utf8"))

if (executable === "launchctl") process.exit(0)
if (executable === "bd") {
  if (args[0] === "config") process.exit(0)
  if (args[0] === "ready") console.log(JSON.stringify(board().ready))
  else if (args[0] === "list") console.log(JSON.stringify(board().active))
  else if (args[0] === "sql") console.log(JSON.stringify([{ head: board().sequence }]))
  else if (args[0] === "events") {
    let sequence = Number(args[args.indexOf("--since") + 1])
    watchFile(fixture, { interval: 50 }, () => {
      const current = board().sequence
      if (current > sequence) {
        sequence = current
        console.log(JSON.stringify({ seq: sequence, op: "update" }))
      }
    })
  } else process.exit(1)
} else if (executable === "t3") {
  if (args.includes("show")) console.log(JSON.stringify({ thread: { archived: false } }))
  else if (args.includes("send")) {
    let message = ""
    for await (const chunk of process.stdin) message += chunk
    appendFileSync(
      process.env.WATCH_BEADS_DELIVERIES!,
      JSON.stringify({ thread: args[args.indexOf("send") + 1], message }) + "\n",
    )
    console.log(JSON.stringify({ accepted: true }))
  } else process.exit(1)
}
