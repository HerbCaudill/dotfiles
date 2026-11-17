import { expect, test } from "vitest"

import { guardGitignore } from "../guardGitignore.ts"

test("keeps the .vercel entry but drops env patterns that vercel link appends", () => {
  const before = "node_modules\ndist\n"
  const after = "node_modules\ndist\n.env*\n.vercel\n"
  expect(guardGitignore(before, after)).toEqual({
    content: "node_modules\ndist\n.vercel\n",
    dropped: [".env*"],
  })
})

test("leaves the file alone when vercel link changed nothing", () => {
  const before = "node_modules\n.vercel\n"
  expect(guardGitignore(before, before)).toEqual({ content: before, dropped: [] })
})

test("does not duplicate an existing .vercel entry", () => {
  const before = "node_modules\n.vercel\n"
  const after = "node_modules\n.vercel\n.env*\n.vercel\n"
  expect(guardGitignore(before, after)).toEqual({ content: before, dropped: [".env*"] })
})

test("adds .vercel to a file that lacks a trailing newline", () => {
  expect(guardGitignore("dist", "dist\n.env*\n.vercel\n")).toEqual({
    content: "dist\n.vercel\n",
    dropped: [".env*"],
  })
})

test("creates the file with only .vercel when vercel link created it", () => {
  expect(guardGitignore(undefined, ".env*\n.vercel\n")).toEqual({
    content: ".vercel\n",
    dropped: [".env*"],
  })
})
