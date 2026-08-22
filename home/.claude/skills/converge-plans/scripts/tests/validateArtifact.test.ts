import { describe, expect, test } from "vitest"

import { validateArtifact } from "../validateArtifact.ts"

describe("validateArtifact", () => {
  test("accepts a complete draft for the expected run, author, and round", () => {
    expect(
      validateArtifact(validDraft(), {
        author: "claude",
        run: "014-detail-forms",
      }),
    ).toMatchObject({ author: "claude", kind: "draft", sequence: 1 })
  })

  test("rejects literal backslash-n sequences outside fenced code", () => {
    expect(() =>
      validateArtifact(validDraft().replace("The goal.", "The goal.\\n## Hidden"), {
        author: "claude",
        run: "014-detail-forms",
      }),
    ).toThrow("literal \\n")
  })

  test("allows literal backslash-n sequences inside fenced code", () => {
    expect(() =>
      validateArtifact(
        validDraft().replace("The goal.", "The goal.\n\n```text\nfirst\\nsecond\n```"),
        { author: "claude", run: "014-detail-forms" },
      ),
    ).not.toThrow()
  })

  test("rejects conflict markers", () => {
    expect(() =>
      validateArtifact(validDraft().replace("The approach.", "<<<<<<< ours\nThe approach."), {
        author: "claude",
        run: "014-detail-forms",
      }),
    ).toThrow("conflict marker")
  })

  test("rejects a draft with the wrong required headings", () => {
    expect(() =>
      validateArtifact(validDraft().replace("## Tasks", "## Steps"), {
        author: "claude",
        run: "014-detail-forms",
      }),
    ).toThrow("## Tasks")
  })

  test("rejects a draft without an unresolved-questions section", () => {
    expect(() =>
      validateArtifact(validDraft().replace("\n## Unresolved questions\n\nNone.", ""), {
        author: "claude",
        run: "014-detail-forms",
      }),
    ).toThrow("## Unresolved questions")
  })

  test("rejects response metadata whose round disagrees with its heading", () => {
    expect(() =>
      validateArtifact(validResponse().replace("draft 001", "draft 002"), {
        author: "codex",
        run: "014-detail-forms",
      }),
    ).toThrow("response heading")
  })

  test("rejects round-limit before round five", () => {
    expect(() =>
      validateArtifact(
        validResponse()
          .replaceAll("verdict=revise", "verdict=round-limit")
          .replace("`revise`", "`round-limit`"),
        {
          author: "codex",
          run: "014-detail-forms",
        },
      ),
    ).toThrow("round-limit")
  })
})

/** Build a valid initial Claude draft. */
function validDraft() {
  return `<!-- converge-plans:artifact run=014-detail-forms author=claude kind=draft sequence=001 -->
# Detail forms

## Goal

The goal.

## Approach

The approach.

## Tasks

1. Do the work.

## Unresolved questions

None.
<!-- converge-plans:eof run=014-detail-forms author=claude kind=draft sequence=001 -->
`
}

/** Build a valid first-round Codex response. */
function validResponse() {
  return `<!-- converge-plans:artifact run=014-detail-forms author=codex kind=response sequence=001 own-draft=codex/draft-001.md responds-to=claude/draft-001.md verdict=revise -->
# Response to Claude draft 001

## Improvements to absorb

None.

## Suggestions not accepted

None.

## Remaining material differences

One difference.

## Verdict

\`revise\`
<!-- converge-plans:eof run=014-detail-forms author=codex kind=response sequence=001 own-draft=codex/draft-001.md responds-to=claude/draft-001.md verdict=revise -->
`
}
