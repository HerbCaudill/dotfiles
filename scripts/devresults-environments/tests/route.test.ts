import { expect, test } from "vitest"
import { getRouteSettings } from "../getRouteSettings.ts"
import { parseDrenvArgs } from "../parseDrenvArgs.ts"

test("route accepts a hostname label and repeated instances", () => {
  expect(
    parseDrenvArgs([
      "--host",
      "mini",
      "route",
      "compare-main",
      "--name",
      "devresults-main",
      "--instance",
      "example",
      "--instance",
      "demo",
    ]),
  ).toEqual({
    command: "route",
    host: "mini",
    id: "compare-main",
    name: "devresults-main",
    instances: ["example", "demo"],
  })
  expect(() => parseDrenvArgs(["start", "alpha", "--name", "x"])).toThrow(/only valid for route/)
})

test("route names each instance under the environment label and keeps the legacy TLS name", () => {
  expect(
    getRouteSettings({
      id: "compare-main",
      legacyUrl: "https://example.devlocal.us:30033",
    }),
  ).toEqual({
    upstreamPort: 30033,
    servername: "example.devlocal.us",
    names: ["example.devresults-compare-main"],
  })
  expect(
    getRouteSettings({
      id: "compare-main",
      legacyUrl: "https://example.devlocal.us:30033",
      name: "devresults-main",
      instances: ["example", "demo"],
    }).names,
  ).toEqual(["example.devresults-main", "demo.devresults-main"])
})

test("route rejects names that are not single DNS labels", () => {
  const legacyUrl = "https://example.devlocal.us:30033"
  expect(() => getRouteSettings({ id: "a", legacyUrl, name: "main.localhost" })).toThrow(/label/)
  expect(() => getRouteSettings({ id: "a", legacyUrl, instances: ["Demo"] })).toThrow(/label/)
})
