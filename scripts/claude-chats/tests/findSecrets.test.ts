import { describe, expect, it } from "vitest"
import { findSecrets } from "../findSecrets.ts"

describe("findSecrets", () => {
  it("names the kind of secret without returning its value", () => {
    const value = `ghp_${"a1".repeat(18)}`

    const found = findSecrets(`my token is ${value}`)

    expect(found).toEqual(["GitHub token"])
    expect(JSON.stringify(found)).not.toContain(value)
  })

  it("finds a private key and an assigned password", () => {
    expect(findSecrets("-----BEGIN RSA PRIVATE KEY-----")).toEqual(["private key"])
    expect(findSecrets('password: "hunter2hunter2"')).toEqual(["assigned credential"])
  })

  it("ignores ordinary prose about passwords", () => {
    expect(findSecrets("Your password should be long and unique.")).toEqual([])
  })
})
