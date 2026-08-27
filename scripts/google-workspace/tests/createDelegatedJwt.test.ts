import { generateKeyPairSync, verify } from "node:crypto"
import { describe, expect, test } from "vitest"

import { createDelegatedJwt } from "../createDelegatedJwt.ts"

describe("createDelegatedJwt", () => {
  test("creates a signed one-hour assertion for the delegated user and approved scopes", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
    const jwt = createDelegatedJwt(
      {
        clientEmail: "briefing@example.iam.gserviceaccount.com",
        privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      },
      {
        now: new Date("2026-08-27T08:00:00Z"),
        scopes: ["scope:calendar", "scope:tasks"],
        subject: "herb@devresults.com",
      },
    )

    const [encodedHeader, encodedPayload, signature] = jwt.split(".")
    expect(JSON.parse(Buffer.from(encodedHeader, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    })
    expect(JSON.parse(Buffer.from(encodedPayload, "base64url").toString())).toEqual({
      aud: "https://oauth2.googleapis.com/token",
      exp: Date.parse("2026-08-27T09:00:00Z") / 1000,
      iat: Date.parse("2026-08-27T08:00:00Z") / 1000,
      iss: "briefing@example.iam.gserviceaccount.com",
      scope: "scope:calendar scope:tasks",
      sub: "herb@devresults.com",
    })
    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        publicKey,
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true)
  })
})
