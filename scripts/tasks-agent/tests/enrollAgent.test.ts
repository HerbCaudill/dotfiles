import { expect, test } from "vitest"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { enrollAgent } from "../enrollAgent.ts"

/** Model only the service's public startup/shutdown protocol in an owned child process. */
async function fixture(spaceId = "expected") {
  const root = await mkdtemp(join(tmpdir(), "tasks-enroll-controller-"))
  await mkdir(join(root, "src/agent/service"), { recursive: true })
  await mkdir(join(root, "node_modules/tsx"), { recursive: true })
  await writeFile(join(root, "package.json"), JSON.stringify({ type: "module" }))
  await writeFile(
    join(root, "node_modules/tsx/package.json"),
    JSON.stringify({ type: "module", exports: "./index.js" }),
  )
  await writeFile(join(root, "node_modules/tsx/index.js"), "export {}\n")
  await writeFile(
    join(root, "src/agent/service/main.ts"),
    `import { writeFileSync } from 'node:fs';
process.once('SIGTERM', () => { writeFileSync('stopped', 'yes'); process.exit(0) });
process.stdout.write(JSON.stringify({ status: 'ready', spaceId: ${JSON.stringify(spaceId)}, identityKey: 'identity' }) + '\\n');
setInterval(() => {}, 1000);
`,
  )
  return root
}

test("enrollment returns verified public identity only after its child has stopped", async () => {
  const release = await fixture()
  try {
    expect(
      await enrollAgent({ release, stateDir: join(release, "state"), spaceId: "expected" }),
    ).toEqual({ spaceId: "expected", identityKey: "identity" })
    expect(await readFile(join(release, "stopped"), "utf8")).toBe("yes")
  } finally {
    await rm(release, { recursive: true, force: true })
  }
})

test("wrong-space startup fails and still waits for its owned process to stop", async () => {
  const release = await fixture("different")
  try {
    await expect(
      enrollAgent({ release, stateDir: join(release, "state"), spaceId: "expected" }),
    ).rejects.toThrow("expected enrollment binding")
    expect(await readFile(join(release, "stopped"), "utf8")).toBe("yes")
  } finally {
    await rm(release, { recursive: true, force: true })
  }
})

test("a child that cannot spawn settles without waiting for a nonexistent exit", async () => {
  await expect(
    enrollAgent({
      release: "/absent/tasks-enrollment-fixture",
      stateDir: "/unused",
      spaceId: "expected",
    }),
  ).rejects.toThrow("could not start")
})
