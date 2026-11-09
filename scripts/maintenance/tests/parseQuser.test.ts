import { describe, expect, it } from "vitest"

import { parseQuser } from "../parseQuser.ts"

describe("parseQuser", () => {
  it("reads disconnected and active sessions with their idle minutes", () => {
    const output = [
      " USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME",
      ">herb                                      1  Disc         3:46  11/9/2026 12:10 PM",
      " lynne                 rdp-tcp#0          2  Active          .  11/9/2026 4:00 PM",
      " guest                 rdp-tcp#1          3  Active         12  11/9/2026 4:00 PM",
      " old                                      4  Disc     2+03:04  11/7/2026 9:00 AM",
    ].join("\r\n")
    expect(parseQuser(output)).toEqual([
      { user: "herb", state: "Disc", idleMinutes: 226 },
      { user: "lynne", state: "Active", idleMinutes: 0 },
      { user: "guest", state: "Active", idleMinutes: 12 },
      { user: "old", state: "Disc", idleMinutes: 3064 },
    ])
  })

  it("returns no sessions when nobody is signed in", () => {
    expect(parseQuser("No User exists for *")).toEqual([])
  })
})
