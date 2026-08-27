import { generateKeyPairSync } from "node:crypto"
import { describe, expect, test, vi } from "vitest"

import { requestDelegatedAccessToken } from "../requestDelegatedAccessToken.ts"

describe("requestDelegatedAccessToken", () => {
  test("exchanges a delegated assertion without exposing the service-account key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body))
      expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer")
      expect(body.get("assertion")?.split(".")).toHaveLength(3)
      return new Response(JSON.stringify({ access_token: "short-lived-token" }), { status: 200 })
    })

    await expect(
      requestDelegatedAccessToken(
        {
          clientEmail: "briefing@example.iam.gserviceaccount.com",
          privateKey: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
        },
        {
          fetch,
          now: new Date("2026-08-27T08:00:00Z"),
          scopes: ["scope:tasks"],
          subject: "herb@devresults.com",
        },
      ),
    ).resolves.toBe("short-lived-token")
    expect(fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    )
  })

  test("reports a safe error when Google rejects the assertion", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized_client", private_key: "do-not-log" }), {
          status: 401,
        }),
    )

    await expect(
      requestDelegatedAccessToken(
        { clientEmail: "briefing@example.iam.gserviceaccount.com", privateKey: "invalid" },
        {
          createAssertion: () => "fixture-assertion",
          fetch,
          now: new Date("2026-08-27T08:00:00Z"),
          scopes: ["scope:tasks"],
          subject: "herb@devresults.com",
        },
      ),
    ).rejects.toThrow("Google Workspace delegated authentication failed")
  })
})
