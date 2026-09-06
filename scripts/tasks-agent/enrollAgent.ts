import { spawn } from "node:child_process"

/** Consume stdin only in the reviewed service process, then close it before launchd takes ownership. */
export async function enrollAgent(
  /** Prepared release and selected space. */
  options: {
    /** Isolated release directory. */
    release: string
    /** Private service parent. */
    stateDir: string
    /** Sole space authorized by managed configuration. */
    spaceId: string
  },
) {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "src/agent/service/main.ts",
      "--state-dir",
      options.stateDir,
      "--space",
      options.spaceId,
      "--enroll-stdin",
    ],
    {
      cwd: options.release,
      stdio: ["inherit", "pipe", "inherit"],
    },
  )
  const exited = new Promise<number | null>(resolve => {
    child.once("exit", code => resolve(code))
    child.once("error", () => {
      if (!child.pid) resolve(null)
    })
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let text = ""
  let verified = false
  try {
    const identity = await new Promise<{ spaceId: string; identityKey: string }>(
      (resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Enrollment startup deadline exceeded.")),
          130_000,
        )
        child.stdout.setEncoding("utf8")
        child.stdout.on("data", chunk => {
          text += chunk
          if (Buffer.byteLength(text) > 64 * 1024)
            return reject(new Error("Unexpected service startup response."))
          if (!text.includes("\n")) return
          try {
            const ready = JSON.parse(text.trim())
            if (
              ready.status !== "ready" ||
              ready.spaceId !== options.spaceId ||
              typeof ready.identityKey !== "string"
            )
              throw new Error("Wrong startup binding")
            resolve({ spaceId: ready.spaceId, identityKey: ready.identityKey })
          } catch {
            reject(new Error("The service did not verify the expected enrollment binding."))
          }
        })
        child.once("error", () => reject(new Error("The enrollment process could not start.")))
        void exited.then(() =>
          reject(new Error("Enrollment failed; inspect the fixed service diagnostic above.")),
        )
      },
    )
    verified = true
    return identity
  } finally {
    clearTimeout(timer)
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
    try {
      const code = await Promise.race([
        exited,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Enrollment cleanup did not finish; stop its owning process before recovery.",
                ),
              ),
            75_000,
          )
        }),
      ])
      if (verified && code !== 0)
        throw new Error("Enrollment shutdown failed; inspect storage before starting the service.")
    } catch (error) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
      await exited
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}
