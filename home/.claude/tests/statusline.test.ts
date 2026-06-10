import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { getDirectoryName } = require("../statusline.js") as {
  getDirectoryName: (cwd: string) => string
}

describe("statusline", () => {
  it("renders Windows paths with only the current directory name", () => {
    expect(getDirectoryName("C:\\Code\\DevResults")).toBe("DevResults")
  })

  it("renders POSIX paths with only the current directory name", () => {
    expect(getDirectoryName("/Users/herbcaudill/Code/dotfiles")).toBe("dotfiles")
  })
})
