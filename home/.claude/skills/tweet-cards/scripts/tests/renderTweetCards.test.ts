import { describe, expect, test } from "vitest"

import { renderTweetCards, type TweetResponse } from "../renderTweetCards.ts"

describe("renderTweetCards", () => {
  test("shows tweets in the requested order and escapes their text", () => {
    const html = renderTweetCards(
      {
        data: [
          tweet({ id: "1", text: "first <script>alert(1)</script>" }),
          tweet({ id: "2", text: "second" }),
        ],
        includes: { users: [author] },
      },
      ["2", "1"],
    )

    expect(html.indexOf("second")).toBeLessThan(html.indexOf("first"))
    expect(html).toContain("first &lt;script&gt;alert(1)&lt;/script&gt;")
    expect(html).not.toContain("<script>alert")
  })

  test("uses the full text of a long tweet", () => {
    const html = render(tweet({ text: "Short…", note_tweet: { text: "The whole long tweet" } }))

    expect(html).toContain("The whole long tweet")
    expect(html).not.toContain("Short…")
  })

  test("makes links readable and drops links to the tweet's own media and quote", () => {
    const html = render(
      tweet({
        text: "Read https://t.co/page and https://t.co/other https://t.co/quote https://t.co/photo",
        referenced_tweets: [{ type: "quoted", id: "9" }],
        entities: {
          urls: [
            {
              url: "https://t.co/page",
              expanded_url: "https://example.com/page",
              display_url: "example.com/page",
            },
            {
              url: "https://t.co/other",
              expanded_url: "https://x.com/a/status/5",
              display_url: "x.com/a/status/5",
            },
            {
              url: "https://t.co/quote",
              expanded_url: "https://x.com/b/status/9",
              display_url: "x.com/b/status/9",
            },
            {
              url: "https://t.co/photo",
              expanded_url: "https://x.com/c/status/1/photo/1",
              display_url: "pic",
              media_key: "m1",
            },
          ],
        },
      }),
    )

    expect(html).toContain('<a href="https://example.com/page">example.com/page</a>')
    expect(html).toContain('<a href="https://x.com/a/status/5">x.com/a/status/5</a>')
    expect(html).not.toContain("t.co")
    expect(html).not.toContain("x.com/b/status/9")
  })

  test("shows photos with alt text, and video thumbnails that link out to X", () => {
    const html = renderTweetCards(
      {
        data: [tweet({ id: "1", attachments: { media_keys: ["p", "v"] } })],
        includes: {
          users: [author],
          media: [
            { media_key: "p", type: "photo", url: "https://img.test/photo.jpg", alt_text: "A map" },
            { media_key: "v", type: "video", preview_image_url: "https://img.test/thumb.jpg" },
          ],
        },
      },
      ["1"],
    )

    expect(html).toContain('<img src="https://img.test/photo.jpg" alt="A map">')
    expect(html).toContain('<img src="https://img.test/thumb.jpg" alt="">')
    expect(html.match(/Watch on X/g)).toHaveLength(1)
    expect(html).toContain('href="https://x.com/i/status/1"')
  })

  test("shows a quoted tweet inside the card", () => {
    const html = renderTweetCards(
      {
        data: [tweet({ text: "Look at this", referenced_tweets: [{ type: "quoted", id: "9" }] })],
        includes: {
          users: [author, { id: "b", name: "Quoted Person", username: "quoted" }],
          tweets: [tweet({ id: "9", author_id: "b", text: "The original" })],
        },
      },
      ["1"],
    )

    expect(html).toContain("Quoted Person")
    expect(html).toContain("The original")
  })

  test("shows an article's title instead of its bare link", () => {
    const html = render(
      tweet({
        text: "https://t.co/article",
        article: { title: "A long read" },
        entities: {
          urls: [
            {
              url: "https://t.co/article",
              expanded_url: "https://x.com/i/article/1",
              display_url: "x.com/i/article/1",
            },
          ],
        },
      }),
    )

    expect(html).toContain("A long read")
    expect(html).not.toContain("x.com/i/article/1")
  })

  test("shows compact counts", () => {
    const html = render(
      tweet({ public_metrics: { reply_count: 39, retweet_count: 1_250, like_count: 308_621 } }),
    )

    expect(html).toContain("<b>39</b> replies")
    expect(html).toContain("<b>1.3K</b> reposts")
    expect(html).toContain("<b>308.6K</b> likes")
  })
})

/** Render one tweet by the standard test author. */
const render = (
  /** The tweet to render. */
  item: TweetResponse["data"][number],
) => renderTweetCards({ data: [item], includes: { users: [author] } }, [item.id])

/** Build a tweet with sensible defaults. */
const tweet = (
  /** Fields that differ from the defaults. */
  overrides: Partial<TweetResponse["data"][number]>,
): TweetResponse["data"][number] => ({
  id: "1",
  author_id: "a",
  created_at: "2026-03-21T20:50:14.000Z",
  text: "Hello",
  public_metrics: { reply_count: 0, retweet_count: 0, like_count: 0 },
  ...overrides,
})

const author = { id: "a", name: "An Author", username: "author" }
