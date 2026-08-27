import { describe, expect, test, vi } from "vitest"

import { runDelegatedGws } from "../runDelegatedGws.ts"

describe("runDelegatedGws", () => {
  test("runs gws with a short-lived delegated token and forwards its exit status", async () => {
    const credentials = {
      clientEmail: "briefing@example.iam.gserviceaccount.com",
      privateKey: "private-key",
    }
    const loadCredentials = vi.fn(() => credentials)
    const requestAccessToken = vi.fn(async () => "short-lived-token")
    const spawnGws = vi.fn(() => 7)

    await expect(
      runDelegatedGws(["tasks", "tasklists", "list"], {
        credentialsPath: "/private/service-account.json",
        loadCredentials,
        now: () => new Date("2026-08-27T08:00:00Z"),
        requestAccessToken,
        spawnGws,
      }),
    ).resolves.toBe(7)

    expect(loadCredentials).toHaveBeenCalledWith("/private/service-account.json")
    expect(requestAccessToken).toHaveBeenCalledWith(
      credentials,
      expect.objectContaining({
        scopes: expect.arrayContaining([
          "https://www.googleapis.com/auth/calendar",
          "https://www.googleapis.com/auth/tasks",
        ]),
        subject: "herb@devresults.com",
      }),
    )
    expect(spawnGws).toHaveBeenCalledWith(["tasks", "tasklists", "list"], "short-lived-token")
  })
})
