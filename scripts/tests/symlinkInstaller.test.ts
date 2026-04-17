import { describe, expect, test } from "vitest"

import { DEPRECATION_MESSAGE, installDotfiles } from "../symlinkInstaller.mjs"

describe("installDotfiles", () => {
  test("throws a nix migration error", () => {
    expect(() => installDotfiles({ dotfilesDir: "/tmp/repo", home: "/tmp/home" })).toThrowError(
      DEPRECATION_MESSAGE,
    )
  })
})
