import { readFile, writeFile } from "node:fs/promises"

const [path, command, ...args] = process.argv.slice(2)
process.stdin.setEncoding("utf8")
let text = ""
for await (const chunk of process.stdin) text += chunk
const input = JSON.parse(text)
const requestId = args[args.indexOf("--request-id") + 1]
const state = JSON.parse(await readFile(path, "utf8"))
const metadata = {
  spaceId: "fixture-space",
  timezone: "Europe/Madrid",
  observedAt: "2026-09-06T12:00:00Z",
}
let response = state.receipts[requestId]?.response
if (response && JSON.stringify(state.receipts[requestId].input) !== JSON.stringify(input)) {
  process.stdout.write(JSON.stringify({ status: "invalid" }) + "\n")
  process.exit(2)
}
if (!response && command === "capture") {
  const id = "task-1"
  state.tasks.push({ id, title: input.title, description: "", completedAt: null })
  response = {
    status: "saved",
    requestId,
    metadata,
    result: {
      status: "saved",
      createdIds: [id],
      records: [{ id, kind: "task", creationKey: `capture:${input.eventKey}` }],
    },
  }
} else if (!response && command === "save-description") {
  const task = state.tasks.find((task: { id: string }) => task.id === input.id)
  if (task.description !== input.base) {
    process.stdout.write(JSON.stringify({ status: "conflict" }) + "\n")
    process.exit(3)
  }
  task.description = input.text
  response = {
    status: "saved",
    requestId,
    metadata,
    result: { status: "saved", affectedIds: [task.id] },
  }
}
if (!response) throw new Error("Unexpected fixture command")
state.receipts[requestId] = { response, input }
const loseReply = command === "capture" ? "loseCapture" : "loseDescription"
const lost = state[loseReply]
state[loseReply] = false
await writeFile(path, JSON.stringify(state))
if (lost) process.exit(4)
process.stdout.write(JSON.stringify(response) + "\n")
